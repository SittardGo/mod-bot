/* jshint esversion: 6 */ 
// To log
// - non-selfsub roles assignment removal

const fs = require('fs');
const LOG_LOCATION = __dirname+'/../logs/';

const LOG_EXTENSION = '.log';
const MOD_LOG = 'mod';

class Logger {
    static initGlobalLog(bot) {
        bot.on('MESSAGE', (e, msgObj) => {
            if (bot.userHasRole(msgObj.member, 'bots')) {
                return;
            }
            
            this.log(
                msgObj.author.id,
                msgObj.author.username,
                msgObj.content,
                msgObj.channel.name+'-'+msgObj.channel.id
            )
        });
    }

    static log(userId, username, message, file) {
        const date = new Date;
        const leadingZero = (num) => {
            if (num > 9) return num;
            return `0${num}`;
        }
        
        const formatDate = (date) =>
          [date.getFullYear(), date.getMonth()+1, date.getDate()]
          .map(leadingZero)
          .join('-');
        const formatTime = (date) =>
          [date.getHours(), date.getMinutes(), date.getSeconds()]
          .map(leadingZero)
          .join(':');

        fs.appendFile(
            LOG_LOCATION+file+LOG_EXTENSION,
            `${formatDate(date)} ${formatTime(date)}\t`+
            `${userId}|${username}\t`+`${message}\n`,
            (err) => {
                if (!err) return;
                console.log(err)
            }
        )
    }

    static getModLog() {
        return MOD_LOG;
    }
}

module.exports = Logger;