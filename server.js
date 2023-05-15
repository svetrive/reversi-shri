/* set up the static file server */
let static = require('node-static');

/*http server*/
let http = require('http');

/* assume we are on heroku*/
let port = process.env.PORT;
let directory = __dirname + '/public';

/*if not heroku then adjust port and dir*/
if ((typeof port == 'undefined')|| (port === null)) {
    port = 8080;
    directory = './public';
}

/* set up static web server to deliver files from file system*/
let file = new static.Server(directory);

let app = http.createServer(
    function(request,response){
        request.addListener('end',
            function() {
                file.serve(request,response);
            }
        ).resume();
    }
).listen(port);

console.log('server is running')