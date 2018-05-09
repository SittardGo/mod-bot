/* jshint esversion: 6 */ 
const fs           = require('fs');

const Logger       = require('./Logger');
const MessageTests = require('./MessageTests');
const Utils        = require('./Utils');
const joinMessages = require('./joinMessages.json');

const WELCOME_FILE = __dirname+'/welcome_message';
const MESSAGES = {
    NO_MEMBER_FOUND: 'Geen lid gevonden, gebruik een \`@username\` in je bericht',
    MODS_NEED_REGION: 'Moderators dienen een regio te specificeren (Sittard/Geleen)',
    REGION_NOT_FOUND: 'Regio niet gevonden',
    USER_NOT_FOUND: 'User niet gevonden',
    TEAM_ADDED: 'Team toegevoegd!',
    REGION_ADDED: 'User toegevoegd aan {REGION}'
};

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
            this.bot.reply(message, MESSAGES.NO_MEMBER_FOUND);
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

        this.bot.reply(message, MESSAGES.MODS_NEED_REGION);
    }

    setRegion(region, user, message) {
        const role = this.findRole(region);
        if (!role) {
            this.bot.reply(message, MESSAGES.REGION_NOT_FOUND);
            return;
        }

        const member = this.bot.getUserById(user.id);

        if (!member) {
            this.bot.reply(message, MESSAGES.USER_NOT_FOUND);
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

        const joinMsg = joinMessages[
            Math.floor(Math.random() * joinMessages.length)
        ].replace('{NAME}', member.toString());

        member.addRole(role)
            .then(_ => {
                this.bot.reply(
                    message,
                    MESSAGES.REGION_ADDED.replace('{REGION}', region)
                );
                this.bot.send(channel, `**→ ${joinMsg}**`);
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

        this.bot.reply(message, MESSAGES.TEAM_ADDED);
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
