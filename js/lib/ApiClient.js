/**
 *
 * Example Usage:
 *
 *     # on command line in test dir
 *     node
 *
 *     # in node Repl
 *     var ApiClient = require('./ApiClient')
 *     var a = new ApiClient('http://localhost:9090')
 *     a.createUser('j3@j3.com','j3')
 *     a.login('j3@j3.com','j3')
 *     TODO: How to use this function: a.claimCore('3').then(function(g,b) { console.log("AAAAAAAAAAA", g,b) })
 *
 **/
var when = require('when');
var http = require('http');
var request = require('request');

/**
 * Provides a framework for interacting with and testing the API
 *
 */

var ApiClient = function (baseUrl) {
    this.baseUrl = baseUrl;
};

ApiClient.prototype = {
    createUser: function (user, pass) {
        var dfd = when.defer();

        //todo; if !user, make random?
        //todo; if !pass, make random?

        //curl -d username=zachary@spark.io -d password=foobar https://api.spark.io/v1/users

        console.log('creating user ', user, pass);
        var that = this;

        request({
            uri: this.baseUrl + "/v1/users",
            method: "POST",
            form: {
                username: user,
                password: pass
            },
            json: true,
            strictSSL: false
        }, function (error, response, body) {
            if (body && body.ok) {
                console.log('user creation succeeded!');
                that._user = user;
                that._pass = pass;
            }
            else if (body && !body.ok && body.errors) {
                console.log("User creation ran into an issue: ", body.errors);
            }
            else {
                console.log("createUser got ", error, response, body);
            }

            dfd.resolve(response);
        });

        return dfd.promise;
    },

    //GET /oauth/token
    login: function (user, pass) {
        var dfd = when.defer();

        //todo; if !user, make random?
        //todo; if !pass, make random?

        //curl -d username=zachary@spark.io -d password=foobar https://api.spark.io/v1/users

        console.log('logging in user ', user, pass);
        var that = this;

        request({
            uri: this.baseUrl + "/oauth/token",
            method: "POST",
            form: {
                username: user,
                password: pass,
                grant_type: 'password',
                client_id: "spark",
                client_secret: "client_secret_here"
            },
            json: true,
            strictSSL: false
        }, function (error, response, body) {
            if (body && body.access_token) {
                console.log("Got an access token! " + body.access_token);
            }
            else if (body) {
                console.log("login got ", body.error);
                dfd.reject("Login Failed - No access token!");
            }
            else {
                console.error("login error: ", error);
            }

            if (body) {
                that._access_token = body.access_token;
            }
            dfd.resolve(response);
        });

        return dfd.promise;
    },

    //GET /v1/devices
    listDevices: function () {
        console.log("Retrieving cores... (this might take a few seconds)");

        var dfd = when.defer();
        var that = this;

        request({
            uri: this.baseUrl + "/v1/devices?access_token=" + this._access_token,
            method: "GET",
            json: true,
            strictSSL: false
        }, function (error, response, body) {
            if (error) {
                console.log("listDevices got error: ", error);
            }

            //console.log("listDevices said", body);

            that._devices = body;
            dfd.resolve(body);
        });

        return dfd.promise;
    },

    claimCore: function (coreID) {
        console.log("claiming core " + coreID);

        var dfd = when.defer();
        var that = this;

        request({
            uri: this.baseUrl + "/v1/devices",
            method: "POST",
            form: {
                id: coreID,
                access_token: this._access_token
            },
            json: true,
            strictSSL: false
        }, function (error, response, body) {

            if (body && body.ok) {
                console.log("Successfully claimed core " + coreID);
                dfd.resolve(body);
            }
            else if (body && body.errors) {
                console.log("Failed to claim core, server said ", body.errors);
                dfd.reject(body);
            }
        });

        return dfd.promise;
    },

    removeCore: function (coreID) {
        console.log("releasing core " + coreID);

        var dfd = when.defer();
        var that = this;

        request({
            uri: this.baseUrl + "/v1/devices/" + coreID,
            method: "DELETE",
            form: {
                id: coreID,
                access_token: this._access_token
            },
            json: true,
            strictSSL: false
        }, function (error, response, body) {

            console.log("server said ", body);

            if (body && body.ok) {
                //console.log("Successfully removed core " + coreID);
                dfd.resolve(body);
            }
            else if (body && body.error) {
                //console.log("Failed to remove core, server said " + body.error);
                dfd.reject(body.error);
            }
        });

        return dfd.promise;
    },


    renameCore: function (coreID, name) {
        console.log("renaming core " + coreID);
        var dfd = when.defer();

        request({
            uri: this.baseUrl + "/v1/devices/" + coreID,
            method: "POST",
            form: {
                id: coreID,
                name: name,
                access_token: this._access_token
            },
            json: true,
            strictSSL: false
        }, function (error, response, body) {
            if (body && body.ok) {
                console.log("Successfully renamed core " + coreID);
                dfd.resolve(body);
            }
            else if (body && body.errors) {
                console.log("Failed to rename core, server said ", body.errors);
                dfd.reject(body);
            }
        });

        return dfd.promise;
    },

    //GET /v1/devices/{DEVICE_ID}
    getAttributes: function (coreID) {
        //console.log('getAttributes for core ' + coreID);

        var dfd = when.defer();
        var that = this;

        request({
            uri: this.baseUrl + "/v1/devices/" + coreID + "?access_token=" + this._access_token,
            method: "GET",
            json: true,
            strictSSL: false
        }, function (error, response, body) {

            if (error) {
                console.log("getAttributes got error: ", error);
            }
//            else {
//                console.log("getAttributes got back ", body);
//            }

            dfd.resolve(body);
        });

        return dfd.promise;
    },

    //GET /v1/devices/{DEVICE_ID}/{VARIABLE}
    getVariable: function (coreID, name) {
        var dfd = when.defer();
        request({
                uri: this.baseUrl + "/v1/devices/" + coreID + "/" + name + "?access_token=" + this._access_token,
                method: "GET",
                json: true,
                strictSSL: false
            },
            function (error, response, body) {
                if (error) {
                    dfd.reject(error);
                }
                dfd.resolve(body);
            });

        return dfd.promise;
    },

    //PUT /v1/devices/{DEVICE_ID}
    signalCore: function (coreID, beSignalling) {
        console.log('signalCore for user ');

        var dfd = when.defer();
        var that = this;

        request({
            uri: this.baseUrl + "/v1/devices/" + coreID,
            method: "PUT",
            form: {
                signal: (beSignalling) ? 1 : 0,
                access_token: this._access_token
            },
            json: true,
            strictSSL: false
        }, function (error, response, body) {
            //console.log(error, response, body);
            if (error) {
                console.log("signalCore got error: ", error);
            }
            else {
                console.log("Core signalling change succeeded!");
            }

            that._devices = body;
            dfd.resolve(response);
        });

        return dfd.promise;
    },

    //PUT /v1/devices/{DEVICE_ID}
    flashCore: function (coreID, files) {
        console.log('attempting to flash firmware to your core ' + coreID);

        var dfd = when.defer();
        var that = this;

        request({
            uri: this.baseUrl + "/v1/devices/" + coreID,
            method: "PUT",
            form: {
                files: files,
                access_token: this._access_token
            },
            json: true,
            strictSSL: false
        }, function (error, response, body) {
            //console.log(error, response, body);
            if (error) {
                console.log("flash core got error: ", error);
            }
            else {
                console.log("flash core succeeded");
            }

            that._devices = body;
            dfd.resolve(response);
        });

        return dfd.promise;
    },


    sendPublicKey: function (coreID, buffer) {
        console.log('attempting to add a new public key for core ' + coreID);

        var dfd = when.defer();
        var that = this;

        request({
            uri: this.baseUrl + "/v1/provisioning/" + coreID,
            method: "POST",
            form: {
                deviceID: coreID,
                publicKey: buffer.toString(),
                order: "manual_" + ((new Date()).getTime()),
                filename: "cli",
                access_token: this._access_token
            },
            json: true,
            strictSSL: false
        }, function (error, response, body) {
            //console.log(error, response, body);
            if (error || body.error) {
                console.log("submitPublicKey got error: ", error || body.error);
            }
            else {
                console.log("submitting public key succeeded!");
            }

            that._devices = body;
            dfd.resolve(response);
        });

        return dfd.promise;
    },


    //PUT /v1/devices/{DEVICE_ID}
    renameCore: function (coreID, coreName) {
        console.log('asking the server to set the friendly name for ' + coreID + ' to ' + coreName);

        var dfd = when.defer();
        var that = this;

        request({
            uri: this.baseUrl + "/v1/devices/" + coreID,
            method: "PUT",
            form: {
                name: coreName,
                access_token: this._access_token
            },
            json: true,
            strictSSL: false
        }, function (error, response, body) {
            //console.log(error, response, body);
            if (error) {
                console.log("signalCore got error: ", error);
            }
            else {
                console.log("Rename core succeeded");
            }

            that._devices = body;
            dfd.resolve(response);
        });

        return dfd.promise;
    },

    callFunction: function (coreID, functionName, funcParam) {
        console.log('callFunction for user ');

        var dfd = when.defer();
        var that = this;

        request({
            uri: this.baseUrl + "/v1/devices/" + coreID + "/" + functionName,
            method: "POST",
            form: {
                arg: funcParam,
                access_token: this._access_token
            },
            json: true,
            strictSSL: false
        }, function (error, response, body) {
            //console.log(error, response, body);
            if (error) {
                console.log("callFunction got error: ", error);
            }
            else {
                console.log("callFunction succeeded ", body);
            }

            that._devices = body;
            dfd.resolve(response);
        });

        return dfd.promise;
    },

    foo:null
};

module.exports = ApiClient;
