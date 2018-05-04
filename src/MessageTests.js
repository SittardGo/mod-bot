/* jshint esversion: 6 */ 

const regex = {
    // Create a subscribe channel/role
    createsub: /^\s*!create/,
    // Remove a subscribe channel/role
    removesub: /^\s*!remove/,
    escape: /[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g,
};

class MessageTests {
    static getTest(test, userInput) {
        test = test.toLowerCase();
        
        if (!regex.hasOwnProperty(test)) {
            return false;
        }

        let r = regex[test];
        if (userInput) {
            r = String(r).replace('[VAR]', this.escapeRegExp(userInput));
            r = new RegExp(r);
        }

        return r;
    }

    static is(test, msg, userInput) {
        const r = this.getTest(test, userInput);
        
        if (!r) {
            return false;
        }

        return r.test(msg);
    }

    static escapeRegExp(str) {
        return str.replace(regex.escape, "\\$&");
    }

    static stripCommand(test, msg, userInput, onlyOnliners = true) {
        const r = this.getTest(test, userInput);
        
        // This removes any user submitted junk from extra lines
        if (onlyOnliners) {
            msg = msg.split('\n')[0];
        }
        
        if (!r) {
            console.warn(`Test: ${test} not defined`);
            return msg;
        }

        return msg.replace(r, '').trim();
    }
}

module.exports = MessageTests;