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
