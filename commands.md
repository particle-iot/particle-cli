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

particle help - show available commands and extra info
particle setup - setup an account, and a new device
particle setup --wifi  -   particle serial wifi - Configure wifi credentials over serial
particle identify      -   particle serial identify - Ask for and display device ID via serial

particle get - particle variable get
particle call - particle function call

particle list          - particle cloud list, particle variable list, particle function list

particle core add      - particle cloud claim
particle core remove   - particle cloud remove
particle core rename   - particle cloud name

particle flash         - particle cloud flash
particle compile       - particle cloud compile
particle login         - particle cloud login
particle logout        - particle cloud logout

particle subscribe - Starts listening and parsing server sent events from the api to your console
particle monitor   - particle variable monitor - Connect and display messages from a device


particle flash --usb - particle flash firmware
particle flash --cloud  - particle flash cloud  -- (default)


particle serial list - Show devices connected via serial to your computer
particle serial monitor - Connect and display messages from a device


particle keys new - Generate a new set of keys for your device
particle keys load - Load a saved key on disk onto your device
particle keys save - Save a key from your device onto your disk
particle keys send - Tell a server which key you'd like to use by sending your public key
particle keys doctor - Creates and assigns a new key to your device, and uploads it to the cloud
particle keys server - Switch server public keys

particle webhook create - Creates a postback to the given url when your event is sent
particle webhook list - Show your current Webhooks
particle webhook delete - Deletes a Webhook



--contested namespaces -- these will both have basic server / clients, so a one-name command might not work.
particle udp   -   particle udp send - Sends a UDP packet to the specified host and port
            -   particle udp listen
particle tcp   -   particle tcp send
            -   particle tcp listen
