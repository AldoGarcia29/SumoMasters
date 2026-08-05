import { Module } from '@nestjs/common';
import { CombatesModule } from '../combates/combates.module';
import { RankingController } from './ranking.controller';
import { RankingService } from './ranking.service';

@Module({
  imports: [CombatesModule],
  controllers: [RankingController],
  providers: [RankingService],
})
export class RankingModule {}
