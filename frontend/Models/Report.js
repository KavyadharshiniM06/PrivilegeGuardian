const mongoose=require('mongoose');
const userschema=new mongoose.Schema(
    {
        report:{type:String,required:true},
        generatedBy:{type:String,required:true},
        date:{type:Date,required:true, default: Date.now },
        format:{type:String,required:true},
        status:{type:String,required:true}
    }
)
module.exports=mongoose.model("report",userschema);