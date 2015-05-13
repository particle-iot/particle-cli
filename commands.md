A small file for helping me visualize which commands should go where, and which commands have been implemented.


[x]	variable
    [x] list
    [x] get
    [x] monitor

[x]	serial
    [x] list
    [x] monitor
    [x] coreid
    [x] wifi
    [ ] terminal

[ ]	keys
    [x] new
    [x] load
    [x] save
    [x] send
    [x] doctor

[ ] cloud
    [x] claim
    [x] rename
    [x] name
    [x] flash
    [x] login
    [x] logout
    [x] compile



    [ ] access / token / login
    [ ] login - generates a token for the cli, saves it locally
    [ ] list - shows cores registered to your user
    [ ] core_name
        - lists functions / variables / time last seen online

[ ] compile
[ ] flash
[ ] doctor
		check the core's external flash

[ ] servers
		list
		change
			-- change server key
			-- change core key
		 	-- write server ip to external flash


[ ] shortcuts -
    call - call function
    get - get variable


[ ] local
    compile
    flash
    tcp listen
    udp listen


commands without a home
	core ID broadcast listener on startup
	tcp / udp helpers



New Command Layout:
===================

spark help - show available commands and extra info
spark setup - setup an account, and a new device
spark setup --wifi  -   spark serial wifi - Configure wifi credentials over serial
spark identify      -   spark serial identify - Ask for and display device ID via serial

spark get - spark variable get
spark call - spark function call

spark list          - spark cloud list, spark variable list, spark function list

spark core add      - spark cloud claim
spark core remove   - spark cloud remove
spark core rename   - spark cloud name

spark flash         - spark cloud flash
spark compile       - spark cloud compile
spark login         - spark cloud login
spark logout        - spark cloud logout

spark subscribe - Starts listening and parsing server sent events from the api to your console
spark monitor   - spark variable monitor - Connect and display messages from a device


spark flash --usb - spark flash firmware
spark flash --cloud  - spark flash cloud  -- (default)


spark serial list - Show devices connected via serial to your computer
spark serial monitor - Connect and display messages from a device


spark keys new - Generate a new set of keys for your device
spark keys load - Load a saved key on disk onto your device
spark keys save - Save a key from your device onto your disk
spark keys send - Tell a server which key you'd like to use by sending your public key
spark keys doctor - Creates and assigns a new key to your device, and uploads it to the cloud
spark keys server - Switch server public keys

spark webhook create - Creates a postback to the given url when your event is sent
spark webhook list - Show your current Webhooks
spark webhook delete - Deletes a Webhook



--contested namespaces -- these will both have basic server / clients, so a one-name command might not work.
spark udp   -   spark udp send - Sends a UDP packet to the specified host and port
            -   spark udp listen
spark tcp   -   spark tcp send
            -   spark tcp listen
