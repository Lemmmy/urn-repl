os.execute = nil
io.popen = nil
arg[0] = "bin/urn.lua"
return dofile("bin/urn.lua")
