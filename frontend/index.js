require('dotenv').config();
const cors=require('cors');
const express=require('express');
const mongoose=require('mongoose');
mongoose.connect('mongodb+srv://sank:sank@cluster0.itsgluw.mongodb.net/?appName=Cluster0',{
}).then(()=>{
    console.log("Connected to MongoDB");
}).catch((err)=>{
    console.error("Error connecting to MongoDB:",err);
});
const port=4000;
const app=express();
const auth = require('./Routes/User');

app.use(cors());
app.use(express.json());
app.use('/api',auth);
app.listen(port,()=>
{
    console.log(`Server is running on port ${port}`);
})  