const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");

const schema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        minlength: 3
    },
    friends: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Person'
        }
    ]
});

schema.plugin(uniqueValidator);
module.exports = mongoose.model('User', schema);