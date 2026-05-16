const mongoose = require("mongoose");

const MatchSchema = new mongoose.Schema({
    homeTeam:           { name: { type: String, required: true }, logo: { type: String, required: true } },
    awayTeam:           { name: { type: String, required: true }, logo: { type: String, required: true } },
    league:             { type: String, required: true },
    startTime:          { type: Date, required: true },
    endTime:            { type: Date, required: true },
    status:             { type: String, enum: ["UPCOMING", "LIVE", "ENDED"], default: "UPCOMING" },
    homeScore:          { type: Number, default: 0 },
    awayScore:          { type: Number, default: 0 },
    slug:               { type: String, required: true, unique: true },
    metadata:           { type: Object, default: {} },
}, { timestamps: true });

module.exports = mongoose.model("Match", MatchSchema);