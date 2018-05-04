/* jshint esversion: 6 */ 
const fs           = require('fs');

const Logger       = require('./Logger');
const MessageTests = require('./MessageTests');
const Utils        = require('./Utils');

const WELCOME_FILE = __dirname+'/welcome_message';
const LEAVE_MSG    = '🚫 {NAME} heeft de server verlaten';

class Bellboy {
    constructor(bot, config) {
        this.bot = bot;
        this.modChannel = config['channel-ids'].moderators;
        this.lobbyChannel = config['channel-ids'].lobby;
        this.modNames = config['mod-role-names'];
        this.inviter = config['inviter-role-names'];

        // Member joined
        this.bot.getClient().on(
            'guildMemberAdd',
            this.sendAWarmWelcome.bind(this)
        );
        
        // Member left
        this.bot.getClient().on(
            'guildMemberRemove',
            this.announceRemoval.bind(this)
        ); 

        // Member command
        this.bot.getClient().on(
            'message',
            this.roleCommand.bind(this)
        );
    }

    sendAWarmWelcome(member) {
        let welcome = fs.readFileSync(WELCOME_FILE, 'UTF-8');
        this.bot.send(
            this.lobbyChannel,
            welcome.replace(/{NAME}/g, member.toString())
        );
        
    }

    announceRemoval(member) {
        const name = Utils.getNameOfMemberObj(member);
        this.bot.send(
            this.modChannel,
            LEAVE_MSG.replace('{NAME}', name)
        );
    }

    roleCommand(message) {
        if (message.channel.id !== this.lobbyChannel) {
            return;
        }

        if (!MessageTests.is('lobbycmd', message.content)) {
            return;
        }
        console.log('lobby do role');

        let team = false;
        switch (message.content.toLowerCase().trim()) {
            case '!valor': team = 'valor'; break;
            case '!mystic': team = 'mystic'; break;
            case '!instinct': team = 'instinct'; break;
        }

        if (team) {
            return this.setTeam(team, message.member);
        }

        // if (!MessageTests.is('joincmd', message.content)) {
        //     return;
        // }

        // Test if user has permition
        const authRole = message.member.roles.filter(r => {
            if (this.modNames.includes(r.name.toLowerCase())) {
                return true;
            }
            if (this.inviter.includes(r.name.toLowerCase())) {
                return true;
            }

            return false;
        });

        if (authRole.array().length === 0) {
            return;
        }

        const user = message.mentions.users.first();
        if (!user) {
            this.bot.reply(message, 'Geen lid gevonden, gebruik een \`@username\` in je bericht');
            return;
        }

        if (message.content.toLowerCase().includes('sittard')) {
            // Do Sittard
            return;
        }

        if (message.content.toLowerCase().includes('Geleen')) {
            // Do Geleen
            return;
        }

    }

    setTeam(team, member) {
        const rId = this.findRole(team);
        
        if (!rId) {
            return;
        }

        // TODO: test if user has team

        this.bot.reply(message, 'Team toegevoegd!');
        member.addRole(rId).catch(console.error);
    }

    findRole(roleName) {
        const found = this.bot.getGuild().role.find(r => {
            return r.name.toLowerCase() === roleName;
        });

        if (!found) {
            return false;
        }

        return found.id;
    }
}

module.exports = Bellboy;