const mongoose = require('mongoose');

const url = "mongodb+srv://divyanshsharma:kartik$2280@cluster0.bb4gl0n.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";


const connectDB = async()=>{
  await mongoose.connect('mongodb+srv://divyanshsharma:kartik$2280@cluster0.bb4gl0n.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0')

  console.log(`the db is connected with ${mongoose.connection.host}`);

}

connectDB()
