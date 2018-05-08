/* jshint esversion: 6 */ 

// TODO: Adding geleen / sittard role = message in region main channel
const fs           = require('fs');

const Logger       = require('./Logger');
const MessageTests = require('./MessageTests');
const Utils        = require('./Utils');

const WELCOME_FILE = __dirname+'/welcome_message';

class Bellboy {
    constructor(bot, config) {
        this.bot = bot;
        this.modChannel = config['channel-ids'].moderators;
        this.lobbyChannel = config['channel-ids'].lobby;
        this.regionSittardChannel = config['channel-ids']['region-sittard'];
        this.regionGeleenChannel = config['channel-ids']['region-geleen'];
        this.modNames = config['mod-role-names'];
        this.inviters = config['inviter-role-names'];

        // Member joined
        this.bot.getClient().on(
            'guildMemberAdd',
            this.sendAWarmWelcome.bind(this)
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

    roleCommand(message) {
        if (message.channel.id !== this.lobbyChannel) {
            return;
        }

        if (!MessageTests.is('lobbycmd', message.content)) {
            return;
        }

        let team = false;
        switch (message.content.toLowerCase().trim()) {
            case '!valor': team = 'valor'; break;
            case '!mystic': team = 'mystic'; break;
            case '!instinct': team = 'instinct'; break;
        }

        if (team) {
            return this.setTeam(team, message);
        }

        if (!MessageTests.is('joincmd', message.content)) {
            return;
        }

        let inviteFromInviter = false;
        const authRole = message.member.roles.filter(r => {
            if (this.modNames.includes(r.name.toLowerCase())) {
                return true;
            }
            if (this.inviters.includes(r.name.toLowerCase())) {
                inviteFromInviter = true;
                return true;
            }

            return false;
        });

        if (authRole.array().length === 0) {
            return;
        }

        const user = message.mentions.users.first();
        if (!user) {
            this.bot.reply(
                message,
                'Geen lid gevonden, gebruik een \`@username\` in je bericht'
            );
            return;
        }

        if (inviteFromInviter) {
            message.member.roles.map(r => {
                if (r.name.toLowerCase() === 'inviters-sittard') {
                    this.setRegion('sittard', user, message);
                }

                if (r.name.toLowerCase() === 'inviters-geleen') {
                    this.setRegion('geleen', user, message);
                }
            });

            return;
        }

        if (message.content.toLowerCase().includes('sittard')) {
            this.setRegion('sittard', user, message);
            return;
        }

        if (message.content.toLowerCase().includes('geleen')) {
            this.setRegion('geleen', user, message);
            return;
        }

        this.bot.reply(
            message,
            'Moderators dienen een regio te specificeren (Sittard/Geleen)'
        );
    }

    setRegion(region, user, message) {
        const role = this.findRole(region);
        if (!role) {
            this.bot.reply(message, 'Regio niet gevonden');
            return;
        }

        const member = this.bot.getUserById(user.id);

        if (!member) {
            this.bot.reply(message, 'User niet gevonden');
            return;
        }

        let channel = '';
        switch (region) {
            case 'sittard': channel = this.regionSittardChannel; break;
            case 'geleen': channel = this.regionGeleenChannel; break;
        }

        Logger.log(
            message.author.id,
            message.author.username,
            `[INVITE]  ${this.bot.getUsernameOfUserId(user.id)} invited to ${region}`,
            Logger.getModLog()
        );

        member.addRole(role)
            .then(_ => {
                this.bot.send(
                    channel,
                    `**→ Welkom nieuw lid ${member.toString()}!**`
                );
            })
            .catch(console.error);
    }

    setTeam(team, message) {
        const rId = this.findRole(team);
        
        if (!rId) {
            return;
        }

        const hasTeam = message.member.roles.some(r => {
            return ['mystic', 'valor', 'instinct']
                .includes(r.name.toLowerCase());
        });

        if (hasTeam) {
            return;
        }

        this.bot.reply(message, 'Team toegevoegd!');
        message.member.addRole(rId).catch(console.error);
    }

    findRole(roleName) {
        const found = this.bot.getGuild().roles.find(r => {
            return r.name.toLowerCase() === roleName;
        });

        if (!found) {
            return false;
        }

        return found.id;
    }
}

module.exports = Bellboy;
