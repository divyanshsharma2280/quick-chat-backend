const express = require('express');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors  = require('cors');
const app = express();
const server = require('http').createServer(app)
const io = require('socket.io')(8080, {
    cors: {
        origin: 'http://localhost:3000',
    }
})

//connect db
const mongoose = require('mongoose');

const url = "mongodb+srv://divyanshsharma:kartik$2280@cluster0.bb4gl0n.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";


const connectDB = async()=>{
  await mongoose.connect('mongodb+srv://divyanshsharma:kartik$2280@cluster0.bb4gl0n.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0')

  console.log(`the db is connected with ${mongoose.connection.host}`);

}

connectDB()

const Users = require('./models/Users');
const Conversation = require('./models/conversation');
const Messages = require('./models/messages');

// app use
app.use(express.json());
app.use(express.urlencoded({extended:false}));
app.use(cors());
const port = process.env.PORT || 8000;

let users = [];
io.on('connection', socket => {
    console.log('User Connected',socket.id);
    socket.on('addUser', userId =>{
        const isUserExist = users.find(user => user.userId === userId);
        if(!isUserExist){
            const user = { userId: userId, socketId: socket.id};
            users.push(user);
            io.emit('getUsers',users);
        }
    });

    socket.on('sendMessage', async ({ senderId, receiverId, message, conversationId}) =>{
        const receiver = users.find(user => user.userId === receiverId);
        const sender = users.find(user => user.userId === senderId );
        const user = await Users.findById(senderId);
        if(receiver){
                io.to(receiver.socketId).to(sender.socketId).emit('getMessage', {
                    senderId,
                    message,
                    conversationId,
                    receiverId,
                    user: { id: user._id, fullname: user.fullName, email: user.email }
                });
        } else {
                io.to(sender.socketId).emit('getMessage',{
                    senderId,
                    message,
                    conversationId,
                    receiverId,
                    user: { id: user._id, fullname: user.fullName, email: user.email }
            })
        }
    })

    socket.on('disconnect', () => {
        users = users.filter(user => user.socketId !== socket.id);
        io.emit('getUsers', users);
    });
    //io.emit('getUsers', socket.userId);
});


// Routes
app.get('/',(req,res) => {
    res.send('Welcome');
})

app.post('/api/register', async (req,res,next)=>{
    try{
        const { fullName, email, password} = req.body;

        if(!fullName||!email||!password){
            res.status(400).send('Please fill all required fields');
        }
        else{
            const isAlreadyExist = await Users.findOne({ email});
            if(isAlreadyExist) {
                res.status(400).send('User already exists');
            }
            else{
                const newUser = new Users({fullName, email});
                bcryptjs.hash(password, 10, (err,hashedPassword)=>{
                    newUser.set('password',hashedPassword);
                    newUser.save();
                    next();                   
                })
                return res.status(200).send('User registered successfully');
            }
        }
    }catch(error){
        return res.status(400).send('error');
    }
})


app.post('/api/login', async (req,res, next) => {
        try{
            const {email, password} = req.body;

            if(!email || !password){
                res.status(400).send('Please fill all required fileds');
            }
            else{
                const user = await Users.findOne({ email });
                if(!user){
                    res.status(400).send('User email or password is incorrect');
                } else{
                    const validateUser = await bcryptjs.compare(password, user.password);
                    if(!validateUser){
                        res.status(400).send('User email or password is incorrect');
                    } else {
                        const payload = {
                            userId: user._id,
                            email: user.email
                        };
                        const JWT_SECRET_KEY = "ed9cfc3b9de43a08088a918c0fa684c8a47277c48febcdb552293090f122aaa7"
                        if (!JWT_SECRET_KEY) {
                            return res.status(500).json({ error: 'JWT secret key is not defined' });
                        }
                    
                        jwt.sign(payload, JWT_SECRET_KEY, {expiresIn: 84600}, async (err, token) => {
                            await Users.updateOne({_id: user._id},{
                                $set: { token }
                            })
                            user.save();
                            return res.status(200).json({user: { id: user._id, email: user.email, fullName: user.fullName}, token: token })
                        });
                    }
                }
            }
        }
        catch(error){
            console.log(error, 'Error')
        }
})

app.post('/api/conversation', async (req, res) => {
    try {
        const { senderId, receiverId } = req.body;

        const newConversation = new Conversation({
            numbers: [senderId, receiverId]
        });

        await newConversation.save();
        res.status(200).send('Conversation created successfully');
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('An error occurred while creating the conversation');
    }
});




app.get('/api/conversation/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        
        // Fetch conversations containing the userId
        const conversations = await Conversation.find({ numbers: { $in: [userId] } });

        // Map over conversations to fetch user details for the receiver
        const conversationUserData = await Promise.all(conversations.map(async (conversation) => {
            // Find the receiverId
            const receiverId = conversation.numbers.find((number) => number !== userId);
            if (!receiverId) {
                throw new Error('Receiver ID not found');
            }
            
            // Fetch user data for the receiver
            const user = await Users.findById(receiverId);
            if (!user) {
                throw new Error('User not found');
            }

            return { user: { receiverId: user._id, email: user.email, fullName: user.fullName }, conversationId: conversation._id };
        }));

        // Send response with conversation user data
        res.status(200).json(conversationUserData);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});


app.post('/api/message', async (req,res) => {
    try {
        const {conversationId, senderId , message, receiverId =''} = req.body;
        if(!senderId || !message) return res.status(400).send('Please fill all required fileds')
        if(conversationId==='new' && receiverId){
            const newConversation = new Conversation({
                numbers: [senderId,receiverId]
            });
            await newConversation.save();
            const newMessage = new Messages({ conversationId: newConversation._id, senderId, message})
            await newMessage.save();
            return res.status(200).send('Message sent successfully')
        }else if(!conversationId && !receiverId){
            return res.status(400).send('Please fill all required fileds')
        }
        const newMessage = new Messages({conversationId, senderId, message});
        await newMessage.save();
        res.status(200).send('Message sent Successfully');
    } catch( error){
        console.log(error, 'Error')
    }
})

app.post('/api/message/:conversationId', async (req,res) => {
    try{
        const checkMessages = async (conversationId) => {
                const messages = await Messages.find({ conversationId });
                const messageUserData = Promise.all(messages.map(async (messages) =>{
                const user = await Users.findById(messages.senderId);
                return { user: {id : user._id, email: user.email, fullName: user.fullName}, message: messages.message}
            }));
            res.status(200).json(await messageUserData);
        }

        const conversationId = req.params.conversationId;
        if(conversationId === 'new'){ 
            const checkConversation = await Conversation.find({ numbers: { $in: [req.query.senderId, req.query.receiverId]}});
            if(checkConversation.length>0) {
                checkMessages(checkConversation[0]._id);
            } else{
                return res.status(200).json([]);
            }
        } else{
            checkMessages(conversationId);
        }
        

    } catch (error){
        console.log('Error', error)
    }
})

app.get('/api/users/:userId', async(req,res) =>{
    try{
        const userId = req.params.userId;
        const users = await Users.find({ _id: {$ne : userId}});
        const userData  = Promise.all(users.map(async (user) => {
            return { user: { email: user.email, fullName: user.fullName, receiverId: user._id}}
        }))
        res.status(200).json( await userData);
    } 
    catch (error) {
        console.log('Error', error)
    }
})

app.listen(port, () => {
    console.log('listening on port ' + port);
})


