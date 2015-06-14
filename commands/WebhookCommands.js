/**
 ******************************************************************************
 * @file    commands/WebhookCommands.js
 * @author  David Middlecamp (david@spark.io)
 * @company Particle ( https://www.particle.io/ )
 * @source https://github.com/spark/particle-cli
 * @version V1.0.0
 * @date    14-February-2014
 * @brief   Webhook commands module
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
var when = require('when');
var sequence = require('when/sequence');

var settings = require('../settings.js');
var path = require('path');
var extend = require('xtend');
var util = require('util');
var fs = require('fs');

var BaseCommand = require("./BaseCommand.js");
var ApiClient = require('../lib/ApiClient.js');
var utilities = require('../lib/utilities.js');


var WebhookCommand = function (cli, options) {
    WebhookCommand.super_.call(this, cli, options);
    this.options = extend({}, this.options, options);

    //TODO: better way to render and insert this template
    this.usagesByName.create = this.usagesByName.create.concat(
        JSON.stringify(WebhookCommand.HookJsonTemplate, null, 2).split("\n")
    );

    this.init();
};
util.inherits(WebhookCommand, BaseCommand);

WebhookCommand.HookJsonTemplate = {
    "eventName": "my-event",
    "url": "https://my-website.com/fancy_things.php",
    "coreID": "optionally filter by providing a device id",

    "_": "The following parameters are optional",
    "requestType": "POST",
    "headers": null,
    "query": null,
    "json": null,
    "auth": null,
    "mydevices": true
};

WebhookCommand.prototype = extend(BaseCommand.prototype, {
    options: null,
    name: "webhook",
    description: "Experimental Beta - helpers for reacting to device event streams",



    usagesByName: {
        "create": [
            "particle webhook create hook.json",
            "particle webhook create eventName url deviceID",
            "",
            "The url will receive a request with the event name and data whenever one of your devices ",
            "publish an event starting with the provided name.  If you do optionally provide a json ",
            "filename you can set lots of advanced properties when creating your hook",

            "",
            "Optional JSON Template:",
            //JSON.stringify(WebhookCommand.HookJsonTemplate, null, 2),

        ]
    },

    init: function () {
        this.addOption("create", this.createHook.bind(this), "Creates a postback to the given url when your event is sent");
        this.addOption("list", this.listHooks.bind(this), "Show your current Webhooks");
        this.addOption("delete", this.deleteHook.bind(this), "Deletes a Webhook");
        this.addOption("remove", this.deleteHook.bind(this), "Deletes a Webhook");
	    this.addOption("POST", this.createPOSTHook.bind(this), "Create a new POST request hook");
        this.addOption("GET", this.createGETHook.bind(this), "Create a new GET request hook");
    },

    createPOSTHook: function(eventName, url, coreID) {
        return this.createHook(eventName, url, coreID, "POST");
    },

    createGETHook: function(eventName, url, coreID) {
        return this.createHook(eventName, url, coreID, "GET");
    },

    createHook: function (eventName, url, coreID, requestType) {
        var api = new ApiClient(settings.apiUrl, settings.access_token);
        if (!api.ready()) {
            return -1;
        }

        if (!eventName && !url && !coreID && !requestType) {
            var help = this.cli.getCommandModule("help");
            return help.helpCommand(this.name, "create");
        }

        //if they gave us one thing, and it happens to be a file, and we could parse it as json
        var data = {};
        if (eventName && !url && !coreID) {

            //
            // for clarity
            //
            var filename = eventName;
            if (fs.existsSync(filename)) {
                data = utilities.tryParse(fs.readFileSync(filename)) || {};
                console.log("Using settings from the file " + filename);
            }

            //only override these when we didn't get them from the command line
            eventName = data.eventName;
            url = data.url;
            coreID = data.coreID;
        }

        //required param
        if (!eventName || (eventName == "")) {
            console.log("Please specify an event name");
            return -1;
        }

        //required param
        if (!url || (url == "")) {
            console.log("Please specify a url");
            return -1;
        }

		//TODO: clean this up more?
		data.event = eventName;
		data.url = url;
		data.deviceid = coreID;
		data.access_token = api._access_token;
		data.requestType = requestType || data.requestType;

		api.createWebhookWithObj(data);

        return 0;
    },

    deleteHook: function (hookID) {
        var api = new ApiClient(settings.apiUrl, settings.access_token);
        if (!api.ready()) {
            return -1;
        }

        if (!hookID || (hookID == "")) {
            console.log("Please specify a hook id");
            return -1;
        }

        api.deleteWebhook(hookID);
        return 0;
    },

    listHooks: function () {
        var api = new ApiClient(settings.apiUrl, settings.access_token);
        if (!api.ready()) {
            return -1;
        }

        when(api.listWebhooks()).then(
            function (hooks) {
                console.log("Found " + hooks.length + " hooks registered\n");
                for(var i=0;i < hooks.length;i++) {
                    var hook = hooks[i];
                    var line = [
                        "    ", (i+1),
                        ".) Hook ID " + hook.id + " is watching for ",
                        "\""+hook.event+"\"",

                        "\n       ", " and posting to: " + hook.url,

                        (hook.deviceID) ? "\n       " + " for device " + hook.deviceID : "",

                        "\n       ", " created at " + hook.created_at,
                        "\n"
                    ].join("");

                    console.log(line);
                }
            },
            function (err) {
                console.error("Problem listing webhooks " + err);
            });
        return 0;
    },


    _: null
});

module.exports = WebhookCommand;
