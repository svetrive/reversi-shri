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

// set up registry of player info and their socket ids 
let players = [];

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

    

    /* join_room command handler*/
    /* expect client to send room to be joined and username*/
    /* we send back join room response, success with room and username and count or failure reason and socket id*/
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

            if ((typeof sockets == 'undefined') || (sockets === null) || !sockets.includes(socket)) {

                response = {};
                response.result = 'fail';
                response.messages = 'server internal error joining chat room';
                socket.emit('join_room_response', response);
                serverLog('join_room command failed', JSON.stringify(response));
            } else{
                // joins ok
                players[socket.id] = {
                    username: username,
                    room: room
                }
                // announce to everyone that is in the room who else is in the room
                for (const member of sockets) {
                    response = {
                        result: 'success',
                        socket_id: member.id,
                        room: players[member.id].room,
                        username: players[member.id].username,
                        count: sockets.length
                    };
                
                
                /*tell everyone someone joined*/
                io.of('/').to(room).emit('join_room_response', response);
                
                serverLog('join_room command success', JSON.stringify(response));
                if(room !== "Lobby") {
                    send_game_update(socket, room, 'initial update');
                }
                    
                }
            }
        
        });

    });


        /* invite command handler*/
    /* expect client to send room to be joined and username*/
    /* we send back join room response, success with room and username and count or failure reason and socket id*/
    socket.on('invite', (payload) => {
        serverLog('Server received a command','\'invite\'', JSON.stringify(payload));
        
        /* check if data coming from client is good*/
        if ((typeof payload == 'undefined') || (payload === null)) {
            response = {};
            response.result = 'fail';
            response.messages = 'client did not send a payload';
            socket.emit('invite_response', response);
            serverLog('invite command failed', JSON.stringify(response));
            return;
        }
        let requested_user = payload.requested_user;
        let room = players[socket.id].room;
        let username = players[socket.id].username;

        if ((typeof requested_user == 'undefined') || (room === null) || (requested_user === "")) {
            response = {
                result: 'fail',
                message: 'client did not request a valid user to invite to play'
            };
            socket.emit('invite_response', response);
            serverLog('invite command failed', JSON.stringify(response));
            return;
        }

        
        if ((typeof room == 'undefined') || (room === null) || (room === "")) {
            response = {
                result: 'fail',
                message: 'the user that was invited does not ghave a room'
            };
            socket.emit('invite_response', response);
            serverLog('invite command failed', JSON.stringify(response));
            return;
        }


        if ((typeof username == 'undefined') || (username === null) || (username === "")) {
            response = {
                result: 'fail',
                message: 'user invited does not have name registered'
            };
            socket.emit('invite_response', response);
            serverLog('invite command failed', JSON.stringify(response));
            return;
        }




        /* handle command*/
        socket.join(room);

        /*check if invited player is present*/
        io.in(room).allSockets().then((sockets)=> {

            // invitee isnt in room
            if ((typeof sockets == 'undefined') || (sockets === null) || !sockets.has(requested_user)) {

                response = {
                    result: 'fail',
                    message: 'user invited is not in room'
                };
                socket.emit('invite_response', response);
                serverLog('invite command failed', JSON.stringify(response));
                return;
            } else{
                // is in room ok
                response = {
                    result: 'success',
                    socket_id: requested_user
                };
                socket.emit('invite_response', response);

                response = {
                    result: 'success',
                    socket_id: socket.id
                };
                socket.to(requested_user).emit('invited', response);
                serverLog('invite command success', JSON.stringify(response));
            }
        
        });

    });


   /* uninvite command handler*/
    /* expect client to send room to be joined and username*/
    /* we send back join room response, success with room and username and count or failure reason and socket id*/
    socket.on('uninvite', (payload) => {
        serverLog('Server received a command','\'uninvite\'', JSON.stringify(payload));
        
        /* check if data coming from client is good*/
        if ((typeof payload == 'undefined') || (payload === null)) {
            response = {};
            response.result = 'fail';
            response.messages = 'client did not send a payload';
            socket.emit('uninvited', response);
            serverLog('uninvite command failed', JSON.stringify(response));
            return;
        }
        let requested_user = payload.requested_user;
        let room = players[socket.id].room;
        let username = players[socket.id].username;

        if ((typeof requested_user == 'undefined') || (room === null) || (requested_user === "")) {
            response = {
                result: 'fail',
                message: 'client did not request a valid user to uninvite to play'
            };
            socket.emit('uninvited', response);
            serverLog('uninvite command failed', JSON.stringify(response));
            return;
        }

        
        if ((typeof room == 'undefined') || (room === null) || (room === "")) {
            response = {
                result: 'fail',
                message: 'the user that was uninvited does not ghave a room'
            };
            socket.emit('uninvited', response);
            serverLog('uninvite command failed', JSON.stringify(response));
            return;
        }


        if ((typeof username == 'undefined') || (username === null) || (username === "")) {
            response = {
                result: 'fail',
                message: 'user uninvited does not have name registered'
            };
            socket.emit('uninvited', response);
            serverLog('uninvite command failed', JSON.stringify(response));
            return;
        }




        /* handle command*/
        socket.join(room);

        /*check if invited player is present*/
        io.in(room).allSockets().then((sockets)=> {

            // uninvitee isnt in room
            if ((typeof sockets == 'undefined') || (sockets === null) || !sockets.has(requested_user)) {

                response = {
                    result: 'fail',
                    message: 'user uninvited is not in room'
                };
                socket.emit('uninvited', response);
                serverLog('uninvite command failed', JSON.stringify(response));
                return;
            } else{
                // is in room ok
                // send to 2 players 2 responses
                response = {
                    result: 'success',
                    socket_id: requested_user
                };
                socket.emit('uninvited', response);

                response = {
                    result: 'success',
                    socket_id: socket.id
                };
                socket.to(requested_user).emit('uninvited', response);
                serverLog('uninvite command success', JSON.stringify(response));
            }
        
        });

    });



       /* game start command handler*/
    /* expect client to send room to be joined and username*/
    /* we send back join room response, success with room and username and count or failure reason and socket id*/
    socket.on('game_start', (payload) => {
        serverLog('Server received a command','\'game_start\'', JSON.stringify(payload));
        
        /* check if data coming from client is good*/
        if ((typeof payload == 'undefined') || (payload === null)) {
            response = {};
            response.result = 'fail';
            response.messages = 'client did not send a payload';
            socket.emit('game_start_response', response);
            serverLog('game_start command failed', JSON.stringify(response));
            return;
        }
        let requested_user = payload.requested_user;
        let room = players[socket.id].room;
        let username = players[socket.id].username;

        if ((typeof requested_user == 'undefined') || (room === null) || (requested_user === "")) {
            response = {
                result: 'fail',
                message: 'client did not request a valid user to engage in play'
            };
            socket.emit('game_start_response', response);
            serverLog('game_start command failed', JSON.stringify(response));
            return;
        }

        
        if ((typeof room == 'undefined') || (room === null) || (room === "")) {
            response = {
                result: 'fail',
                message: 'the user that was engaged to play is not in room'
            };
            socket.emit('game_start_response', response);
            serverLog('game_start command failed', JSON.stringify(response));
            return;
        }


        if ((typeof username == 'undefined') || (username === null) || (username === "")) {
            response = {
                result: 'fail',
                message: 'user engaged to play does not have name registered'
            };
            socket.emit('game_start_response', response);
            serverLog('game_start command failed', JSON.stringify(response));
            return;
        }




        /* handle command*/
        socket.join(room);

        /*check if player to enageg is present*/
        io.in(room).allSockets().then((sockets)=> {

            // player isnt in room
            if ((typeof sockets == 'undefined') || (sockets === null) || !sockets.has(requested_user)) {

                response = {
                    result: 'fail',
                    message: 'user to play is not in room'
                };
                socket.emit('game_start_response', response);
                serverLog('game_start command failed', JSON.stringify(response));
                return;
            } else{
                // is in room ok
                // send to 2 players 2 responses
                //pick game id
                let game_id = Math.floor(1+Math.random()* 0x100000).toString(16);
                response = {
                    result: 'success',
                    game_id: game_id,
                    socket_id: requested_user
                };
                socket.emit('game_start_response', response);
                socket.to(requested_user).emit('game_start_response', response);
                serverLog('game_start command success', JSON.stringify(response));
            }
        
        });

    });



    socket.on('disconnect', () => {
        serverLog('a page disconnected from the server: '+socket.id);

        // let people know someone disconnected

        if((typeof players[socket.id] != 'undefined') && (players[socket.id] != 'null')) {

            let payload = {
                username: players[socket.id].username,
                room: players[socket.id].room,
                count: Object.keys(players).length -1,
                socket_id: socket.id
            };

            let room = players[socket.id].room;
            delete players[socket.id];

            io.of("/").to(room).emit('player_disconnected', payload);
            serverLog('player_disconnected succeeded', JSON.stringify(payload));

        }

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


    socket.on('play_token', (payload) => {
        serverLog('Server received a command','\'play_token\'', JSON.stringify(payload));
        
        /* check if data coming from client is good*/
        if ((typeof payload == 'undefined') || (payload === null)) {
            response = {};
            response.result = 'fail';
            response.messages = 'client did not send a payload';
            socket.emit('play_token_response', response);
            serverLog('play_token command failed', JSON.stringify(response));
            return;
        }

        let player = players[socket.id];
        
        if ((typeof player == 'undefined') || (player === null)) {
            response = {};
            response.result = 'fail';
            response.messages = 'play_token came from unreg player';
            socket.emit('play_token_response', response);
            serverLog('play_token command failed', JSON.stringify(response));
            return;
        }

        let username= player.username;
        if ((typeof username == 'undefined') || (username === null)) {
            response = {};
            response.result = 'fail';
            response.messages = 'play_token cmd did not come from reg username';
            socket.emit('play_token_response', response);
            serverLog('play_token cmd failed', JSON.stringify(response));
            return;
        }

        let game_id = player.room;
        if ((typeof game_id == 'undefined') || (game_id === null)) {
            response = {};
            response.result = 'fail';
            response.messages = 'no valid game assoc with play_token cmd';
            socket.emit('play_token_response', response);
            serverLog('play_token cmd failed', JSON.stringify(response));
            return;
        }

        let row = payload.row;
        if ((typeof row == 'undefined') || (row === null)) {
            response = {};
            response.result = 'fail';
            response.messages = 'no valid row assoc with play_token cmd';
            socket.emit('play_token_response', response);
            serverLog('play_token cmd failed', JSON.stringify(response));
            return;
        }

        let col = payload.col;
        if ((typeof col == 'undefined') || (col === null)) {
            response = {};
            response.result = 'fail';
            response.messages = 'no valid col assoc with play_token cmd';
            socket.emit('play_token_response', response);
            serverLog('play_token cmd failed', JSON.stringify(response));
            return;
        }

        let color = payload.color;
        if ((typeof color == 'undefined') || (color === null)) {
            response = {};
            response.result = 'fail';
            response.messages = 'no valid color assoc with play_token cmd';
            socket.emit('play_token_response', response);
            serverLog('play_token cmd failed', JSON.stringify(response));
            return;
        }

        let game = games[game_id];
        if ((typeof game == 'undefined') || (game === null)) {
            response = {};
            response.result = 'fail';
            response.messages = 'no valid game assoc with play_token cmd';
            socket.emit('play_token_response', response);
            serverLog('play_token cmd failed', JSON.stringify(response));
            return;
        }

        let response = {
            result: "success"
        }
        socket.emit('play_token_response ', response);

        // execute move 
        if(color == 'white'){
            game.board[row][col] = 'w';
            game.whose_turn = 'black';
          }
          else if(color == 'black'){
            game.board[row][col] = 'b';
            game.whose_turn = 'white';
          }

          send_game_update(socket,game_id, 'played a token');

    });

    

});



/*********************** */

// game state 
let games= [];

function create_new_game() {
    let new_game = {};
    new_game.player_white = {};
    new_game.player_white.socket = "";
    new_game.player_white.username = "";
    new_game.player_black = {};
    new_game.player_black.socket = "";
    new_game.player_black.username = "";

    var d = new Date();
    new_game.last_move = d.getTime();

    new_game.whose_turn = 'white';

    new_game.board = [
        [' ',' ',' ',' ',' ',' ',' ',' '],
        [' ',' ',' ',' ',' ',' ',' ',' '],
        [' ',' ',' ',' ',' ',' ',' ',' '],
        [' ',' ',' ','w','b',' ',' ',' '], //4
        [' ',' ',' ','b','w',' ',' ',' '], //5
        [' ',' ',' ',' ',' ',' ',' ',' '],
        [' ',' ',' ',' ',' ',' ',' ',' '],
        [' ',' ',' ',' ',' ',' ',' ',' ']
    ];

    return new_game;
}

function send_game_update(socket, game_id, message) {
    //check to see if game with game id exists if not make it
    //make sure only 2 people in room 
    //assign this socket a color 
    //check if game is over 


    if ((typeof games[game_id] == 'undefined') || (games[game_id] === null)) {
        console.log('no game exists with game id:' + game_id+ '. making a new game for '+socket.id)
        games[game_id] = create_new_game();
    }


    io.of('/').to(game_id).allSockets().then((sockets) => {

        const iterator = sockets[Symbol.iterator]();
        if (sockets.size >= 1) {
            let first = iterator.next().value;
            if((games[game_id].player_white.socket != first) && (games[game_id].player_black.socket != first)) {
                // check if theyre 1 or 2 otherwise bye 
                if (games[game_id].player_white.socket === "") {
                    // white
                    console.log("white is assigned to" + first);
                    games[game_id].player_white.socket = first;
                    games[game_id].player_white.username = players[first].username;
                }
                else if (games[game_id].player_black.socket === "") {
                    // black
                    console.log("black is assigned to" + first);
                    games[game_id].player_black.socket = first;
                    games[game_id].player_black.username = players[first].username;
                }
                else {
                    // bye
                    console.log("kicking " + first + "out of game " + game_id);
                    io.in(first).socketsLeave([game_id]);
                }
            }
        }

        if (sockets.size >= 2) {
            let second = iterator.next().value;
            if((games[game_id].player_white.socket != second) && (games[game_id].player_black.socket != second)) {
                // check if theyre 1 or 2 otherwise bye 
                if (games[game_id].player_white.socket === "") {
                    // white
                    console.log("white is assigned to" + second);
                    games[game_id].player_white.socket = second;
                    games[game_id].player_white.username = players[second].username;
                }
                else if (games[game_id].player_black.socket === "") {
                    // black
                    console.log("black is assigned to" + second);
                    games[game_id].player_black.socket = second;
                    games[game_id].player_black.username = players[second].username;
                }
                else {
                    // bye
                    console.log("kicking " + second + "out of game " + game_id);
                    io.in(second).socketsLeave([game_id]);
                }
            }
        }


        //send game update 
        let payload={
            result: 'success',
            game_id: game_id,
            game: games[game_id],
            message: message
        };

        io.of("/").to(game_id).emit('game_update', payload);


    });

    // check if game is over 
    let count = 0;
    for (let row = 0; row<8; row++){
        for(let col=0; col<8; col++){
            if (games[game_id].board[row][col] !== ' ') {
                count++;
            }
        }
    }

    if (count === 64) {
        let payload = {
            result: 'success',
            game_id: game_id,
            game: games[game_id],
            who_won: 'everyone'
        }

        io.in(game_id).emit('game_over', payload);

        // delete old games after 1 hour
        // dont want memory to fill up
        setTimeout(
            ((id) => {
                return (() => {
                    delete games[id];
                });
                
            })(game_id)
            , 60*60*1000);
    }
 
}

