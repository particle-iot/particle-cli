A small file for helping me visualize which commands should go where, and which commands have been implemented.


[x]	variable
		list
		get
		monitor

[x]	serial
		[x] list
		[x] monitor
		[x] coreid
		[ ] terminal

[ ]	keys
    [x] new
    [ ] load
    [x] save
    [ ] send

	doctor
		check the core's external flash

	servers
		list
		change
			-- change server key
			-- change core key
		 	-- write server ip to external flash


	cloud
	    [ ] claim
		access / token / login
		login - generates a token for the cli, saves it locally
		list - shows cores registered to your user

		core_name
			- lists functions / variables / time last seen online



	shortcuts -
		call - call function
		get - get variable


	local
		compile
		flash
		tcp listen
		udp listen

	compile

	flash




commands without a home
	core ID broadcast listener on startup
	tcp / udp helpers
