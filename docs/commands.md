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
    [ ] load
    [x] save
    [ ] send

[ ] cloud
    [x] claim
    [x] rename
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
