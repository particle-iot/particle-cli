var when = require('when');
var sequence = require('when/sequence');
var readline = require('readline');



var that = {
    _prompt: null,

    /**
     * Sets up our user input
     */
    getPrompt: function () {
        if (!that._prompt) {
            that._prompt = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
        }
        return that._prompt;
    },

    promptDfd: function (message) {
        var dfd = when.defer();
        var prompt = that.getPrompt();
        prompt.question(message, function (value) {
            dfd.resolve(value);
        });
        return dfd.promise;
    },
    askYesNoQuestion: function (message) {
        var dfd = when.defer();
        var prompt = that.getPrompt();
        prompt.question(message, function (value) {
            value = (value || "").toLowerCase();

            if ((value == "yes") || (value == "y")) {
                dfd.resolve(value);
            }
            else {
                dfd.reject(value);
            }
        });
        return dfd.promise;
    },
    passPromptDfd: function (message) {
        var dfd = when.defer();
        var prompt = that.getPrompt();

        //process.stdin.setRawMode(true);
        prompt.question(message, function (value) {
            //process.stdin.setRawMode(false);
            dfd.resolve(value);
        });
        return dfd.promise;
    },

    areYouSure: function() {
        return that.askYesNoQuestion("Are you sure?  Please Type yes to continue: ");
    },

    getCredentials: function () {
        return sequence([
            that.getUsername,
            that.getPassword
        ]);
    },
    getUsername: function () {
        return that.promptDfd("Could I please have your username? :\t");
    },
    getPassword: function () {
        return that.passPromptDfd("and a password? :\t");
    },

    getWifiCredentials: function () {
        return sequence([
            that.getUsername,
            that.getPassword
        ]);
    },
    getUsername: function () {
        return that.promptDfd("Could I please have your username? :\t");
    },
    getPassword: function () {
        return that.passPromptDfd("and a password? :\t");
    },



    getNewCoreName: function () {
        return that.promptDfd("How shall your core be known? (name?):\t");
    },

    hitEnterWhenReadyPrompt: function () {
        console.log("");
        console.log("");
        console.log("");
        return that.promptDfd("If it isn't too much trouble, would you mind hitting ENTER when you'd like me to start?");
    },

    hitEnterWhenCyanPrompt: function () {
        console.log("");
        console.log("");
        return that.promptDfd("Sorry to bother you again, could you wait until the light is CYAN and then press ENTER?");
    },


    waitFor: function (delay) {
        var temp = when.defer();

        console.log('...(pausing for effect:' + delay + ').');
        setTimeout(function () { temp.resolve(); }, delay);
        return temp.promise;
    },



    foo: null
};
module.exports = that;