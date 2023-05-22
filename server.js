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

console.log('server is running');


/* Set up web socket server */

const { Server } = require("socket.io");
const io = new Server(app);

io.on('connection', (socket) => {

    /* output log msg on server and sent to client*/

    function serverLog(...messages) {
        io.emit('log',['**** Message from server: \n']);
        messages.forEach((item) => {
            io.emit('log',['****\t'+item]);
            console.log(item);
        });
    }


    serverLog('a page connected to the server: '+socket.id);

    socket.on('disconnect', () => {
        serverLog('a page disconnected from the server: '+socket.id);
    });

    /* join_room command handler*/
    /* expect client to send room to be joined and username*/
    /* we send back join room response, success with room and username and count or failure reason*/
    socket.on('join_room', (payload) => {
        serverLog('Server received a command','\'join_room\'', JSON.stringify(payload));
        
        /* check if data coming from client is good*/
        if ((typeof payload == 'undefined') || (payload === null)) {
            response = {};
            response.result = 'fail';
            response.messages = 'client did not send a payload';
            socket.emit('join_room_response', response);
            serverLog('join_room command failed', JSON.stringify(response));
            return;
        }

        let room = payload.room;
        let username = payload.username;

        
        if ((typeof room == 'undefined') || (room === null)) {
            response = {};
            response.result = 'fail';
            response.messages = 'client did not send a room';
            socket.emit('join_room_response', response);
            serverLog('join_room command failed', JSON.stringify(response));
            return;
        }


        if ((typeof username == 'undefined') || (username === null)) {
            response = {};
            response.result = 'fail';
            response.messages = 'client did not send a username';
            socket.emit('join_room_response', response);
            serverLog('join_room command failed', JSON.stringify(response));
            return;
        }




        /* handle command*/
        socket.join(room);

        /*make sure client was put in room*/
        io.in(room).fetchSockets().then((sockets)=> {
            serverLog('There are ' +sockets.length+' clients in the room, '+room);
            

            if ((typeof sockets == 'undefined') || (sockets === null) || !sockets.includes(socket)) {

                response = {};
                response.result = 'fail';
                response.messages = 'server internal error joining chat room';
                socket.emit('join_room_response', response);
                serverLog('join_room command failed', JSON.stringify(response));
            } else{
                response = {};
                response.result = 'success';
                response.room = room;
                response.username = username;
                response.count = sockets.length;
                
                /*tell everyone someone joined*/
                io.of('/').to(room).emit('join_room_response', response);
                
                serverLog('join_room command success', JSON.stringify(response));
                return;
            }
        
        });

    });


    /* send_chat_message command handler*/
    /* room to which msg should be sent, username, msg*/
    /* we send back response, success with username and msg or failure reason*/
    socket.on('send_chat_message', (payload) => {
        serverLog('Server received a command','\'send_chat_message\'', JSON.stringify(payload));
        
        /* check if data coming from client is good*/
        if ((typeof payload == 'undefined') || (payload === null)) {
            response = {};
            response.result = 'fail';
            response.messages = 'client did not send a payload';
            socket.emit('send_chat_message', response);
            serverLog('send_chat_message command failed', JSON.stringify(response));
            return;
        }

        let room = payload.room;
        let username = payload.username;
        let message = payload.message;
        
        if ((typeof room == 'undefined') || (room === null)) {
            response = {};
            response.result = 'fail';
            response.messages = 'client did not send a room to msg';
            socket.emit('send_chat_message', response);
            serverLog('send_chat_message command failed', JSON.stringify(response));
            return;
        }


        if ((typeof username == 'undefined') || (username === null)) {
            response = {};
            response.result = 'fail';
            response.messages = 'client did not send a valid username';
            socket.emit('send_chat_message', response);
            serverLog('send_chat_message cmd failed', JSON.stringify(response));
            return;
        }

        if ((typeof message == 'undefined') || (message === null)) {
            response = {};
            response.result = 'fail';
            response.messages = 'client did not send a valid msg';
            socket.emit('send_chat_message', response);
            serverLog('send_chat_message cmd failed', JSON.stringify(response));
            return;
        }

        /*handle cmd*/

        let response = {};
        response.result = 'success';
        response.username = username;
        response.room = room;
        response.message = message;
        /*tell everyone*/
        io.of('/').to(room).emit('send_chat_message_response', response);
        serverLog('send_chat_message command success', JSON.stringify(response));
        return;

    });

});


