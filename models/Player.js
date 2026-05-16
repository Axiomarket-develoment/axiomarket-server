const mongoose = require("mongoose")


const PlayerSchema = new mongoose.Schema({
    name:           { type: String, required: true },
    image:          { type: String }, 
    playerId:       { type: String }, // for sports players, this can be used to link to external APIs
    team:           { type: String }, // optional team name for sports players
    position:       { type: String }, // optional position for sports players
    age:            { type: Number }, // optional position for sports players
    shirtNumber:    { type: Number }, // optional position for sports players
    nationality:    { type: String }, // optional nationality for sports players
    slug:           { type: String, unique: true,sparse: true  }, // unique identifier for the player
    stats:          { type: Object }, // optional stats object for sports players
    createdAt:      { type: Date, default: Date.now }
}
, {
    timestamps: true
}
);



const Player = mongoose.model("Player", PlayerSchema);

module.exports = Player;