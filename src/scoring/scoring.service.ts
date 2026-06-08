import { Injectable } from '@nestjs/common';
import { Match, Prediction } from '@prisma/client';

@Injectable()
export class ScoringService {
  computeBasePoints(
    prediction: Pick<Prediction, 'homeScore' | 'awayScore'>,
    match: Pick<Match, 'homeScore' | 'awayScore'>,
  ): number {
    if (match.homeScore === null || match.awayScore === null) return 0;

    if (prediction.homeScore === match.homeScore && prediction.awayScore === match.awayScore) {
      return 5;
    }

    let points = 0;
    const predDiff = prediction.homeScore - prediction.awayScore;
    const matchDiff = match.homeScore - match.awayScore;

    if (Math.sign(predDiff) === Math.sign(matchDiff)) points += 3;
    if (predDiff === matchDiff && matchDiff !== 0) points += 2;

    return points;
  }

  computeStreakBonus(basePointsPerPrediction: number[]): number {
    let streak = 0;
    let bonus = 0;
    for (const points of basePointsPerPrediction) {
      if (points >= 3) {
        streak++;
        if (streak % 3 === 0) bonus += 2;
      } else {
        streak = 0;
      }
    }
    return bonus;
  }
}
