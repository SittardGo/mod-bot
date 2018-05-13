/* jshint esversion: 6 */ 
const fs           = require('fs');
const differ       = require('diff-arrays');

const Logger       = require('./Logger');
const MessageTests = require('./MessageTests');
const Utils        = require('./Utils');

const SUBSCRIBE_EMOJI = '👍';
const STORE_FILE      = __dirname+'/../logs/subscribers.json';

const DEFAULT_MODS_NAMES = [
    'admin', 'mods-geleen', 'mods-sittard'
];

const MESSAGES = {
    invalid_create: 'Ongeldig commando, gebruik: \n \`\`\`!create tekst: '+
        '"Inschrijf tekst" channel: "channel-naam" rol: "rol naam"\`\`\` \n'+
        'Een rol of een channel is verplicht. Bij een rol zonder een channel '+
        'zal het channel dezelfde naam als de rol krijgen. '+
        'Zonder een tekst wordt het channel niet zelf inschrijfbaar voor leden',
    created: '\`create\` actie voltooid',
    removed: '\`remove\` actie voltooid \n'+
        '`(indien een channel nog zichtbaar is, herstart je discord client)`'
}

class ChannelSubscriber {
    constructor(bot, channelConfig) {
        this.bot = bot;
        this.modBotChannel = channelConfig['modbot-control'];
        this.subscribeChannel = channelConfig.subscribe;
        this.eventsCategory = channelConfig['events-category'];
        this.mutedRoleId = Utils.getRoleIdByName('muted', this.bot.getGuild());
        this.defaultMods = [];
        DEFAULT_MODS_NAMES.map(mod => {
            const rid = Utils.getRoleIdByName(mod, this.bot.getGuild());
            if (!rid) {
                return;
            }

            this.defaultMods.push(rid);
        });

        // Bulk delete subscribe channel
        this.bot.getChannel(this.subscribeChannel).bulkDelete(80)
        .then(messages => {
            console.log(
                `Deleted ${messages.size} messages from self-sub channel`
            )
            return this.initStore();
        })
        .then(_ => {
            this.initCreator();
            this.initSubscriber();
        });
    }

    initCreator() {       
        this.bot.on('MESSAGE', (e, msgObj) => {
            // Only from modbot channel
            if (msgObj.channel.id !== this.modBotChannel) {
                return;
            }

            // Only from mods
            if (!this.bot.userIsMod(msgObj.member)) {
                return;
            }

            if (MessageTests.is('createsub', msgObj.content)) {
                this.createSubscriberChannel(
                    Utils.removeTest(msgObj, 'createSub'), msgObj
                );
            }

            if (MessageTests.is('removesub', msgObj.content)) {
                this.removeSubscriberChannel(
                    Utils.removeTest(msgObj, 'removeSub'), msgObj
                );
            }
        });
    }

    initStore() {
        try {
            // include the store
            if (fs.existsSync(STORE_FILE)) {
                this.store = require(STORE_FILE);
            }
        } catch(e) {
            console.log('init store error: ', e)
        }

        if (!this.store) {
            this.store = [];
        }
        
        const reApplyMessage = message => {
            return new Promise((res, rej) => {
                this.bot
                .send(this.subscribeChannel, message.text)
                .then(m => {
                    message.id = m.id;
                    return m.react('👍');
                }).then(_ => {
                    res();
                });
            });
        };

        // Restore all the messages in the store
        const promises = this.store.map(sub => {
            if (!sub.message.id) {
                return Promise.resolve();
            }

            return reApplyMessage(sub.message);
        });
        
        return Promise.all(promises)
            .then(_ => {
                this.commitStore();
            });
    }

    createSubscriberChannel(msg, msgObj) {
        msg = msg.split(/[:,',"]/);
        msg = msg.filter(m => m.trim());
        let cmd = {}, i = 0, prevC = '';

        msg.map(c => {
            if (i % 2 > 0) {
                cmd[prevC] = c.trim();
            } else {
                cmd[c.trim()] = '';
                prevC = c.trim();
            }
            i++;
        });

        cmd = Utils.checkCreateMessage(cmd);

        if (!cmd) {
            this.bot.reply(msgObj, MESSAGES.invalid_create);
            return;
        }

        if (cmd.category) {
            cmd.category = Utils.getCategoryIdByName(cmd.category, this.bot);
        }

        if (!cmd.category) {
            cmd.category = this.eventsCategory
        }
        
        let roleId = 0, channelId = 0, messageId = 0;

        // Create the role
        this.createRole(cmd)
        .then(role => {
            roleId = (role) ? role.id : 0;
            return Promise.resolve(roleId);
        })
        // Create the channel
        .then(roleId => {
            return this.createChannel(cmd, roleId);
        })
        // Set the correct parent
        .then(channel => {
            if (!channel) {
                return Promise.resolve();
            }

            channelId = (channel) ? channel.id : 0;
            return channel.setParent(cmd.category);
        })
        // Create the subscribe message
        .then(_ => {
            if (!cmd.text) {
                return Promise.resolve();
            }

            return this.bot.send(this.subscribeChannel, cmd.text);
        })
        // Like everything we say
        .then(message => {
            if (!message) {
                return Promise.resolve();
            }
            
            messageId = message.id;
            return message.react('👍');
        })
        // Store the object
        .then(_ => {
            // #overkill
            const fu = JSON.parse(JSON.stringify([
                cmd.channel, channelId, cmd.role, roleId, cmd.text, messageId
            ]));

            this.addToStore({
                channel: { text: fu[0], id: fu[1] },
                role:    { text: fu[2], id: fu[3] },
                message: { text: fu[4], id: fu[5] },
                users:   []
            });

            this.log('create', msgObj);
            this.bot.reply(msgObj, MESSAGES.created);
        }).catch(e => {
            console.log(e)
            this.bot.send(this.modBotChannel, e.message);
        });
    }

    createChannel(cmd, roleId) {
        if (!cmd.channel) {
            return Promise.resolve(false);
        }

        const everyone = this.bot.getGuild().roles.find('name', '@everyone');
        const perms = [
            { allow: ['VIEW_CHANNEL'], id: this.bot.getClient().user.id },
            { deny: ['SEND_MESSAGES'], id: this.mutedRoleId }
        ];

        this.defaultMods.map(modId => {
            perms.push(
                { allow: ['MANAGE_MESSAGES'], id: modId }
            );
        });

        if (roleId) {
            perms.push({ allow: ['VIEW_CHANNEL'], id: roleId })
            perms.push({ deny: ['VIEW_CHANNEL'], id: everyone.id });
        }

        return this.bot.getGuild().createChannel(cmd.channel, 'text', perms)
    }

    createRole(cmd) {
        if (!cmd.role) {
            return Promise.resolve(false);
        }

        return this.bot.getGuild().createRole({
            name: cmd.role
        });
    }

    removeSubscriberChannel(msg, msgObj) {
        let index = false;
        const entry = this.store.find((sub, i)=> {
            
            if (sub.role.id &&
                (msg.toLowerCase() === sub.role.text.toLowerCase())
            ) {
                index = i;
                return true;
            }

            if (sub.channel.id &&
                (Utils.formatChannelName(msg) === sub.channel.text)
            ) {
                index = i;
                return true;
            }

            return false;
        });

        if (!entry) {
            this.bot.send(this.modBotChannel, 'Geen rol of channel gevonden');
            return;
        }
        
        if (entry.channel.id) {
            const channel = this.bot.getChannel(entry.channel.id);
            if (channel) {
                this.callDelete(channel, 'channel');
            }
        }

        if (entry.role.id) {
            const role = this.bot.getGuild().roles.get(entry.role.id);
            if (role) {
                this.callDelete(role, 'rol');
            }
        }

        if (entry.message.id) {
            this.bot.getChannel(this.subscribeChannel)
            .fetchMessage(entry.message.id)
            .then(message => {
                return this.callDelete(message, 'bericht');
            })
            .catch(e => {
                // Message not found
            });
        }

        this.store.splice(index, 1);
        this.commitStore();
        this.log('delete', msgObj);
        this.bot.reply(msgObj, MESSAGES.removed);
    }

    callDelete(obj, name) {
        return obj.delete()
        .catch(e => {
            this.bot.send(
                this.modBotChannel,
                `Kon ${name} niet verwijderen: ${e.message}`
            );
        });
    }

    initSubscriber() {
        // Adding a reaction
        this.bot.getClient().on(
            'messageReactionAdd',
            this.handleReactions.bind(this)
        );
        
        // Removing a reaction
        this.bot.getClient().on(
            'messageReactionRemove',
            this.handleReactions.bind(this)
        );
    }

    handleReactions(reaction, user) {
        if (user.bot) {
            return;
        }

        if (reaction.message.channel.id !== this.subscribeChannel) {
            return;
        }

        if (reaction.emoji.name !== SUBSCRIBE_EMOJI) {
            return;
        }

        const entry = this.store.find((sub, i) => {
            if (sub.message.id === reaction.message.id) {
                return true;
            }

            return false;
        });

        if (!entry) {
            console.log(`subscribe message ${reaction.message.id} not found`);
            return;
        }

        let newSubs = reaction.users
            .array().filter(u => !u.bot)
            .map(user => user.id);

        // Create a diff for adding and removing
        // lhs will be new, rgh should be removed
        const diff = differ(newSubs, entry.users);

        // Remove users from store
        const users = entry.users.filter(u => {
            return !diff.rhs.includes(u);
        })

        // Add users to store
        entry.users = users.concat(diff.lhs);
        this.commitStore();
        
        // Update the users remove / add the roles
        diff.lhs.map(uId => {
            this.bot.getUserById(uId).addRole(entry.role.id)
              .catch(console.error);
        });

        diff.rhs.map(uId => {
            this.bot.getUserById(uId).removeRole(entry.role.id)
              .catch(console.error);
        });
    }

    addToStore(storeObj) {
        this.store.push(storeObj);
        this.commitStore();
    }

    commitStore() {
        fs.writeFileSync(
            STORE_FILE,
            JSON.stringify(this.store, null, 2)
        );
    }

    log(action, msgObj) {
        action = (action) ? `[${action.toUpperCase()}] ` : action;
        const message = action+msgObj.content
        
        console.log(action+msgObj.content);
        Logger.log(
            msgObj.author.id,
            msgObj.author.username,
            message,
            Logger.getModLog()
        )
    }
}

module.exports = ChannelSubscriber;