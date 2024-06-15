const mongoose = require('mongoose');

const conversationSchema = mongoose.Schema({
    numbers:{
        type: [String],
        required : true,
    }
});

const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;

