-- AlterTable: Add unique constraint on User.googleId
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex: Prediction.matchId
CREATE INDEX "Prediction_matchId_idx" ON "Prediction"("matchId");

-- CreateIndex: Prediction.roomId
CREATE INDEX "Prediction_roomId_idx" ON "Prediction"("roomId");

-- CreateIndex: RoomMember.userId
CREATE INDEX "RoomMember_userId_idx" ON "RoomMember"("userId");
