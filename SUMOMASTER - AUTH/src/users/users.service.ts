import {
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { MongoServerError } from 'mongodb';
import { Model, QueryFilter } from 'mongoose';

import { UpdateRoleDto } from './dto/update-role.dto';
import { Role } from './enums/role.enum';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly saltRounds = 12;

  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.createInitialAdmin();
  }

  async create(
    name: string,
    email: string,
    username: string,
    password: string,
  ): Promise<UserDocument> {
    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim().toLowerCase();

    const existingUser = await this.userModel
      .findOne({
        $or: [{ email: normalizedEmail }, { username: normalizedUsername }],
      })
      .exec();

    if (existingUser) {
      if (existingUser.email === normalizedEmail) {
        throw new ConflictException('El correo ya está registrado');
      }

      if (existingUser.username === normalizedUsername) {
        throw new ConflictException('El nombre de usuario ya está registrado');
      }
    }

    const encryptedPassword = await bcrypt.hash(password, this.saltRounds);

    const user = new this.userModel({
      name: normalizedName,
      email: normalizedEmail,
      username: normalizedUsername,
      password: encryptedPassword,
      roles: [Role.USER],
      active: true,
    });

    try {
      return await user.save();
    } catch (error: unknown) {
      this.handleDuplicateKeyError(error);
      throw error;
    }
  }

  async findForAuthentication(
    identifier: string,
  ): Promise<UserDocument | null> {
    const normalizedIdentifier = identifier.trim().toLowerCase();

    return this.userModel
      .findOne({
        $or: [
          { email: normalizedIdentifier },
          { username: normalizedIdentifier },
        ],
      })
      .select('+password')
      .exec();
  }

  async findById(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id).select('-password').exec();

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return user;
  }

  async findAll(): Promise<UserDocument[]> {
    return this.userModel
      .find()
      .select('-password')
      .sort({ createdAt: -1 })
      .exec();
  }

  async updateRoles(
    id: string,
    updateRoleDto: UpdateRoleDto,
  ): Promise<UserDocument> {
    const uniqueRoles = [...new Set(updateRoleDto.roles)];

    const user = await this.userModel
      .findByIdAndUpdate(
        id,
        {
          $set: {
            roles: uniqueRoles,
          },
        },
        {
          new: true,
          runValidators: true,
        },
      )
      .select('-password')
      .exec();

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return user;
  }

  async changeActiveStatus(id: string, active: boolean): Promise<UserDocument> {
    const user = await this.userModel
      .findByIdAndUpdate(
        id,
        {
          $set: {
            active,
          },
        },
        {
          new: true,
          runValidators: true,
        },
      )
      .select('-password')
      .exec();

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return user;
  }

  private async createInitialAdmin(): Promise<void> {
    const adminEmail = this.configService
      .get<string>('ADMIN_EMAIL')
      ?.trim()
      .toLowerCase();

    const adminUsername = this.configService
      .get<string>('ADMIN_USERNAME')
      ?.trim()
      .toLowerCase();

    const adminPassword = this.configService.get<string>('ADMIN_PASSWORD');

    const adminName =
      this.configService.get<string>('ADMIN_NAME')?.trim() || 'Administrador';

    if (!adminEmail || !adminUsername || !adminPassword) {
      console.warn(
        'No se creó el administrador porque faltan variables ADMIN_*',
      );

      return;
    }

    const query: QueryFilter<UserDocument> = {
      $or: [{ email: adminEmail }, { username: adminUsername }],
    };

    const existingAdmin = await this.userModel.findOne(query).exec();

    if (existingAdmin) {
      let requiresUpdate = false;

      if (!existingAdmin.roles.includes(Role.ADMIN)) {
        existingAdmin.roles = [
          ...new Set([...existingAdmin.roles, Role.ADMIN]),
        ];

        requiresUpdate = true;
      }

      if (!existingAdmin.active) {
        existingAdmin.active = true;
        requiresUpdate = true;
      }

      if (requiresUpdate) {
        await existingAdmin.save();
      }

      console.log('El administrador inicial ya existe');

      return;
    }

    const encryptedPassword = await bcrypt.hash(adminPassword, this.saltRounds);

    try {
      await this.userModel.create({
        name: adminName,
        email: adminEmail,
        username: adminUsername,
        password: encryptedPassword,
        roles: [Role.ADMIN],
        active: true,
      });

      console.log('Administrador inicial creado correctamente');
    } catch (error: unknown) {
      this.handleDuplicateKeyError(error);
      throw error;
    }
  }

  private handleDuplicateKeyError(error: unknown): void {
    if (error instanceof MongoServerError && error.code === 11000) {
      const duplicatedField = Object.keys(error.keyPattern ?? {})[0];

      if (duplicatedField === 'email') {
        throw new ConflictException('El correo ya está registrado');
      }

      if (duplicatedField === 'username') {
        throw new ConflictException('El nombre de usuario ya está registrado');
      }

      if (duplicatedField === 'correo') {
        throw new ConflictException(
          'Existe un índice antiguo llamado correo_1 en MongoDB. Elimina ese índice antes de registrar usuarios.',
        );
      }

      throw new ConflictException(
        duplicatedField
          ? `Ya existe un registro con el campo ${duplicatedField}`
          : 'Ya existe un usuario con esos datos',
      );
    }
  }
}
