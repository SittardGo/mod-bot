/* jshint esversion: 6 */ 
const fs           = require('fs');
const SittardGoBot = require('sittard-go-bot');
const Logger       = require('./Logger');
const ChannelSubscriber  = require('./ChannelSubscriber');

const DEV_MODE = true;

const BOT_STATUS = 'idle';

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

        this.bot.on('MESSAGE', this.receiveMessage.bind(this));

        this.bot.connect()
        .then(_ => {
            // // Set the visibility of the bot
            this.bot.getClient().user.setStatus(BOT_STATUS);
            Logger.messageLog(this.bot);
            new ChannelSubscriber(this.bot, this.config['channel-ids']);

        })
        .catch(e => console.log('error', e));
    }

    receiveMessage(e, msgObj) {
        if (this.bot.userHasRole(msgObj.member, 'bots')) {
            return;
        }
    }
}

module.exports = ModBot;