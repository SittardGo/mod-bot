const MessageTests = require('./MessageTests');

module.exports = {
    getCategoryIdByName(name, bot) {
        name = name.toLowerCase().trim();
        const cats = bot
            .getGuild()
            .channels
            .findAll('type', 'category');
        
        const foundCat = cats.find(c => {
            return c.name.toLowerCase().replace(/\s{2,}/g, ' ') ===
                name.toLowerCase().replace(/\s{2,}/g, ' ');
        });

        if (foundCat) {
            return foundCat.id;
        }

        return false;
    },

    removeTest(msgObj, test) {
        return msgObj.content
            .replace(MessageTests.getTest(test), '')
            .trim();
    },

    checkCreateMessage(message) {
        const allowedProps = [
            'tekst', 'text',
            'categorie', 'category',
            'role', 'rol',
            'channel'
        ]

        for (let i in message) {
            if (!allowedProps.includes(i)) {
                return false;
            }
        }

        // return renamed
        const renamed = {};
        Object.keys(message).map(key => {
            if (key === 'tekst') { 
                renamed.text = message.tekst;
            } else if (key === 'categorie') {
                renamed.category = message.categorie;
            } else if (key === 'rol') {
                renamed.role = message.rol;
            } else if (key === 'kanaal') {
                renamed.channel = message.kanaal;
            } else {
                renamed[key] = message[key];
            }
        });

        if (!renamed.channel && !renamed.role) {
            return false;
        }

        if (renamed.role && !renamed.channel) {
            renamed.channel = renamed.role;
        }

        if (renamed.channel) {
            renamed.channel = this.formatChannelName(renamed.channel);
        }

        return renamed;
    },

    getNameOfMemberObj(member) {
        return (member.nickname) ? member.nickname : member.user.username;
    },

    formatChannelName(ch) {
        return ch
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '')
            .trim();
    }
};