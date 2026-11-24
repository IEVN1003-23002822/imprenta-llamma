import { correoUnico, unico } from '../helpers/datos';

export interface UsuarioInput {
  nombre: string;
  correo: string;
  password: string;
  rol: string;
}

export const userFactory = {
  valido(overrides: Partial<UsuarioInput> = {}): UsuarioInput {
    return {
      nombre: `Usuario ${unico('e2e')}`,
      correo: correoUnico('usuario'),
      password: 'PasswordSeguro123!',
      rol: 'ventas',
      ...overrides,
    };
  },
  invalido: {
    passwordCorta: (overrides: Partial<UsuarioInput> = {}) =>
      userFactory.valido({ password: '1234567', ...overrides }),
    correoInvalido: (overrides: Partial<UsuarioInput> = {}) =>
      userFactory.valido({ correo: 'no-es-correo', ...overrides }),
    rolInexistente: (overrides: Partial<UsuarioInput> = {}) =>
      userFactory.valido({ rol: 'superadmin', ...overrides }),
  },
};
