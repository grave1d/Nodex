// Tests must not inherit local server authentication from the developer shell.
delete process.env['NODEX_API_KEY'];
