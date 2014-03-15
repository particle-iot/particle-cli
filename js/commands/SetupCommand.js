/**
 ******************************************************************************
 * @file    js/commands/SetupCommand.js
 * @author  David Middlecamp (david@spark.io)
 * @company Spark ( https://www.spark.io/ )
 * @source https://github.com/spark/spark-cli
 * @version V1.0.0
 * @date    14-February-2014
 * @brief   Setup commands module
 ******************************************************************************
 Copyright (c) 2014 Spark Labs, Inc.  All rights reserved.

 This program is free software; you can redistribute it and/or
 modify it under the terms of the GNU Lesser General Public
 License as published by the Free Software Foundation, either
 version 3 of the License, or (at your option) any later version.

 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 Lesser General Public License for more details.

 You should have received a copy of the GNU Lesser General Public
 License along with this program; if not, see <http://www.gnu.org/licenses/>.
 ******************************************************************************
 */

var settings = require('../settings.js');
var BaseCommand = require("./BaseCommand.js");
var dfu = require('../lib/dfu.js');
var prompts = require('../lib/prompts.js');
var ApiClient = require('../lib/ApiClient.js');
var utilities = require('../lib/utilities.js');

var when = require('when');
var sequence = require('when/sequence');
var pipeline = require('when/pipeline');
var readline = require('readline');
var fs = require('fs');
var path = require('path');
var extend = require('xtend');
var util = require('util');


var SetupCommand = function (cli, options) {
    SetupCommand.super_.call(this, cli, options);
    this.options = extend({}, this.options, options);

    this.init();
};
util.inherits(SetupCommand, BaseCommand);
SetupCommand.prototype = extend(BaseCommand.prototype, {
    options: null,
    name: "setup",
    description: "Helps guide you through the initial claiming of your core",

    init: function () {

        //this.addOption("list", this.listCores.bind(this));
        this.addOption("*", this.runSetup.bind(this), "Guides you through setting up your account and your core");
    },

    runSetup: function () {
        console.log("Lets setup your core!");
        var api = new ApiClient(settings.apiUrl, settings.access_token);   //
        var serial = this.cli.findCommand("serial"),
            cloud = this.cli.findCommand("cloud");

        var that = this,
            coreID,
            coreName;


        var allDone = pipeline([

            //already logged in or not?
            function () {
                if (settings.access_token) {
                    var inAs = (settings.username) ? " as " + settings.username : "";
                    var line = "You're logged in" + inAs + ", do you want to switch accounts? (y/n): ";
                    return prompts.askYesNoQuestion(line, true);
                }
                else {
                    return when.resolve(true);
                }
            },


            //1.) prompt for user/pass,
            //1a - check if account exists, prompt to create an account
            //2.) confirm pass,
            //3.) create user,

            function (switchAccounts) {
                if (!switchAccounts) {
                    //skip this then
                    return when.resolve();
                }

                return that.login_or_create_account(api);
            },
            function (token) {
                if (token) {
                    console.log("Logged in!  Saving access token.");
                    settings.override("access_token", api.getToken());
                }
            },

            //4.) connect core blinking blue,
            //5.) grab core identity,

            function () {
                if (!serial) {
                    return when.reject("Couldn't find serial module");
                }

                var getCoreID = function () {
                    console.log("Make sure your core is blinking solid blue (in listening mode) and is connected to your computer");
                    return serial.identifyCore();
                };

                return utilities.retryDeferred(getCoreID, 3);
            },

            function (serialID) {
                if (!serialID) {
                    console.log("I couldn't find your core ID, sorry!");
                    return when.reject("Couldn't get core ID");
                }

                //console.log("It looks like your core id is: " + serialID);
                coreID = serialID;

                return when.resolve();
            },

            //6.) prompt for / configure wifi creds,
            function () {
                var configWifi = function () {
                    //console.log("Make sure your core is blinking solid blue (in listening mode) and is connected to your computer");
                    return serial.configureWifi(null, true);
                };
                return utilities.retryDeferred(configWifi, 3);
            },

            function () {
                return prompts.promptDfd("Please wait until your core is breathing cyan and then press ENTER");
            },

            //7.) claim core,
            function () {
                return api.claimCore(coreID);
            },

            function () {
                api.signalCore(coreID, true);
                setTimeout(function () {
                    api.signalCore(coreID, false);
                }, 5000);

                return when.resolve();
            },

            //8.) name your core!
            function () {
                return prompts.promptDfd("What would you like to call your core? ");
            },
            function (name) {
                coreName = name;
                return api.renameCore(coreID, name);
            },

            function () {
                return prompts.askYesNoQuestion("Do you want to logout now? (y/n): ", true);
            },
            function (shouldLogout) {
                if (shouldLogout) {
                    return cloud.logout();
                }
                return when.resolve();
            }
        ]);

        //optional
        //8.) prompt for open web browser to spark/build
        //9.) prompt for open web browser to spark/docs


        when(allDone).then(function (access_token) {

                console.log("Congrats " + settings.username + "!");
                console.log("You've successfully claimed your core: " + coreName + " (" + coreID + ")");
                settings.override("access_token", access_token);

                setTimeout(function () {
                    process.exit(-1);
                }, 1250);
            },
            function (err) {
                console.error("Error setting up your core: " + err);
                process.exit(-1);
            });


    },


    /**
     * tries to login, or if that fails, prompt for the password again, and then create an account
     * @param api
     */
    login_or_create_account: function (api) {

        //TODO: make this function more pretty
        var username;

        return pipeline([
            function () {
                return prompts.getCredentials()
            },
            //login to the server
            function (creds) {
                var tmp = when.defer();

                username = creds[0];

                console.log("Trying to login...");

                var loginDone = api.login("spark-cli", creds[0], creds[1]);
                when(loginDone).then(
                    function (token) {
                        if (username) {
                            settings.override("username", username);
                        }

                        //login success
                        tmp.resolve(token);
                    },
                    function () {

                        //create account
                        var createAccountDone = sequence([
                            function () {
                                return prompts.confirmPassword();
                            },
                            function (pass) {
                                if (pass != creds[1]) {
                                    return when.reject("Passwords did not match!");
                                }
                                else {
                                    return when.resolve();
                                }
                            },
                            //TODO: prompt to make sure they want to create a new account?
                            function () {
                                return api.createUser(creds[0], creds[1]);
                            }
                        ]);
                        return utilities.pipeDeferred(createAccountDone, tmp);
                    });

                return tmp.promise;
            }
        ]);
    },


    _: null
});

module.exports = SetupCommand;
