os.execute = nil
io.popen = nil
arg[0] = "tacky/cli.lua"
return dofile("tacky/cli.lua")
