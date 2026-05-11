import { User } from '@/domain/entities/user.entity';
import { InvalidEntityDataException } from '@/domain/exceptions/domain.exception';

const validArgs = {
  id: 'some-id',
  name: 'Juan Pérez',
  email: 'juan@example.com',
  dni: '12345678',
  phone: '1123456789',
};

describe('User Entity', () => {
  it('creates a user with valid data', () => {
    const user = new User(
      validArgs.id,
      validArgs.name,
      validArgs.email,
      validArgs.dni,
      validArgs.phone,
    );
    expect(user.getEmail()).toBe(validArgs.email);
    expect(user.getName()).toBe(validArgs.name);
  });

  it('throws InvalidEntityDataException if name is empty', () => {
    expect(
      () =>
        new User(
          validArgs.id,
          '',
          validArgs.email,
          validArgs.dni,
          validArgs.phone,
        ),
    ).toThrow(InvalidEntityDataException);
  });

  it('throws InvalidEntityDataException if email format is invalid', () => {
    expect(
      () =>
        new User(
          validArgs.id,
          validArgs.name,
          'not-email',
          validArgs.dni,
          validArgs.phone,
        ),
    ).toThrow(InvalidEntityDataException);
  });

  it('throws InvalidEntityDataException if DNI format is invalid', () => {
    expect(
      () =>
        new User(
          validArgs.id,
          validArgs.name,
          validArgs.email,
          'abc',
          validArgs.phone,
        ),
    ).toThrow(InvalidEntityDataException);
  });

  it('accepts DNI with dots', () => {
    const user = new User(
      validArgs.id,
      validArgs.name,
      validArgs.email,
      '12.345.678',
      validArgs.phone,
    );
    expect(user.getDni()).toBe('12.345.678');
  });

  it('throws InvalidEntityDataException if phone is empty', () => {
    expect(
      () =>
        new User(
          validArgs.id,
          validArgs.name,
          validArgs.email,
          validArgs.dni,
          '',
        ),
    ).toThrow(InvalidEntityDataException);
  });
});
