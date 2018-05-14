/* jshint esversion: 6 */ 
const fs                = require('fs');
const SittardGoBot      = require('sittard-go-bot');
const Logger            = require('./Logger');
const ChannelSubscriber = require('./ChannelSubscriber');
const Bellboy           = require('./Bellboy');

const DEV_MODE = false;

const BOT_STATUS = 'invisible';

class ModBot {
    constructor() {
        if (
            !fs.existsSync(__dirname+'/../config.dev.json') &&
            !fs.existsSync(__dirname+'/../config.json')
        ) {
            new SittardGoBot.Bot();
            process.exit(0);
        }
        
        if (DEV_MODE) {
            this.config = require(__dirname+'/../config.dev.json')
            this.bot = new SittardGoBot.Bot(this.config);

            this.bot.on('ERROR', function() {
                process.exit(0);
            });

        } else {
            this.config = require(__dirname+'./../config.json');
            this.bot = new SittardGoBot.Bot(this.config);
        }

        this.bot.connect()
        .then(_ => {
            this.initGlobal();

            // Channel subscriber module
            new ChannelSubscriber(this.bot, this.config['channel-ids']);

            // Lobby (Bellboy) module
            new Bellboy(this.bot, this.config);

            this.bot.on('RECONNECT', this.initGlobal.bind(this));
        })
        .catch(e => console.log('error', e));
    }

    initGlobal() {
        // Set the visibility of the bot
        this.bot.getClient().user.setStatus(BOT_STATUS);

        Logger.initGlobalLog(this.bot);

        this.bot.getClient().on('guildMemberRemove', (member) => {
            Logger.log(
                member.id,
                member.user.username,
                '[LEFT/KICK] this user has left / has been kicked',
                Logger.getModLog()
            )

            this.bot.send(
                'moderators',
                `🚫 ${member.user.username} heeft de server verlaten`
            );
        });

        this.bot.getClient().on('guildBanAdd', (g, user) => {
            Logger.log(
                user.id,
                user.username,
                '[BAN] this user has been banned',
                Logger.getModLog()
            )
            
            this.bot.send(
                'moderators',
                `⚠️ ${user.username} is gebanned`
            );
        });
    }
}

module.exports = ModBot;