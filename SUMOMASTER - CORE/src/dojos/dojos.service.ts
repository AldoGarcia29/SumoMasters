import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { MongoServerError } from 'mongodb';
import { Model } from 'mongoose';
import { CreateDojoDto } from './dto/create-dojo.dto';
import { UpdateDojoDto } from './dto/update-dojo.dto';
import { Dojo, DojoDocument } from './schemas/dojo.schema';

@Injectable()
export class DojosService {
  constructor(
    @InjectModel(Dojo.name) private readonly dojoModel: Model<DojoDocument>,
  ) {}

  async create(dto: CreateDojoDto): Promise<DojoDocument> {
    const dojo = new this.dojoModel({ ...dto, nombre: dto.nombre.trim() });

    try {
      return await dojo.save();
    } catch (error: unknown) {
      this.handleDuplicateKeyError(error);
      throw error;
    }
  }

  findAll(): Promise<DojoDocument[]> {
    return this.dojoModel.find().sort({ nombre: 1 }).exec();
  }

  async findOne(id: string): Promise<DojoDocument> {
    const dojo = await this.dojoModel.findById(id).exec();
    if (!dojo) throw new NotFoundException('Dojo no encontrado');
    return dojo;
  }

  async update(id: string, dto: UpdateDojoDto): Promise<DojoDocument> {
    const dojo = await this.dojoModel
      .findByIdAndUpdate(id, { $set: dto }, { new: true, runValidators: true })
      .exec();

    if (!dojo) throw new NotFoundException('Dojo no encontrado');
    return dojo;
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    const result = await this.dojoModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException('Dojo no encontrado');
    return { deleted: true };
  }

  private handleDuplicateKeyError(error: unknown): void {
    if (error instanceof MongoServerError && error.code === 11000) {
      throw new ConflictException('Ya existe un dojo con ese nombre');
    }
  }
}
