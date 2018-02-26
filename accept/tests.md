keys 8
webhook 5
variable 3
token 3
binary 1
cloud 9

config 6
doctor 1
flash 3
function 2
publish 1
serial 8
subscribe 1
udp 2
update 1


particle keys save <file>
particle keys save <file> --force
particle keys new
particle keys new <file>
particle keys new --protocol udp
particle keys load <file>
particle keys send 54ff70066667515105351367 device
particle keys send 500000000000000000000000 dummy --product_id 10
  ==> For new device ID that doesn't exist. Delete afterwards in cores and core_keys
particle keys doctor 54ff70066667515105351367
particle keys server
particle keys server --host 192.168.0.1 --port 9999 --protocol tcp
particle keys address
particle keys protocol
particle keys protocol --protocol udp
  ==> needs electron
particle variable list
particle variable get <device> <variable>
particle variable get <device>
particle variable get <variable>
particle variable monitor <device> <variable> --time
particle token list
particle token revoke
particle token create
particle binary inspect assets/binaries/photon_tinker.bin

particle cloud login
particle cloud logout
particle cloud list
particle cloud list photon
particle cloud list 54ff70066667515105351367
particle cloud list online
particle cloud claim 25001e000347353137323334
particle cloud remove 25001e000347353137323334
particle cloud name 25001e000347353137323334 foo

particle cloud flash device tinker
particle cloud flash device app.ino
particle cloud flash device
particle cloud flash device app.ino --target 0.6.3
