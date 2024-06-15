const mongoose = require('mongoose');
const Conversation = require('./conversation');

const messageSchema = mongoose.Schema({
    conversationId:{
        type: String,
    },
    senderId: {
        type: String,
    },
    message: {
        type: String,
    }
});

const Messages = mongoose.model('Message', messageSchema);

module.exports = Messages;

