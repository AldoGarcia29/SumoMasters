import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MinLength(3, {
    message: 'El nombre debe contener al menos 3 caracteres',
  })
  @MaxLength(100)
  name: string;

  @IsEmail({}, { message: 'El correo no tiene un formato válido' })
  @IsNotEmpty({ message: 'El correo es obligatorio' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'El username es obligatorio' })
  @MinLength(4, {
    message: 'El username debe contener al menos 4 caracteres',
  })
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message:
      'El username solamente puede contener letras, números, puntos, guiones y guiones bajos',
  })
  username: string;

  @IsString()
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  @MinLength(8, {
    message: 'La contraseña debe contener al menos 8 caracteres',
  })
  @MaxLength(100)
  password: string;
}
