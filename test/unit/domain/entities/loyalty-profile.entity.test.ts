import { LoyaltyProfile } from '@/domain/entities/loyalty-profile.entity';
import { InvalidEntityDataException } from '@/domain/exceptions/domain.exception';
import { randomUUID } from 'crypto';

const conductorId = randomUUID();

describe('LoyaltyProfile', () => {
  it('crea perfil con valores por defecto', () => {
    const p = new LoyaltyProfile({ conductorId });
    expect(p.getId()).toMatch(/^[0-9a-f-]+$/);
    expect(p.getConductorId()).toBe(conductorId);
    expect(p.getLevel()).toBe('bronze');
    expect(p.getTotalXp()).toBe(0);
    expect(p.getPendingXp()).toBe(0);
  });

  it('acepta valores explícitos', () => {
    const id = randomUUID();
    const p = new LoyaltyProfile({ id, conductorId, level: 'gold', totalXp: 100, pendingXp: 20 });
    expect(p.getId()).toBe(id);
    expect(p.getLevel()).toBe('gold');
    expect(p.getTotalXp()).toBe(100);
    expect(p.getPendingXp()).toBe(20);
  });

  describe('addPendingXp', () => {
    it('suma al pendingXp', () => {
      const p = new LoyaltyProfile({ conductorId });
      p.addPendingXp(10);
      expect(p.getPendingXp()).toBe(10);
      p.addPendingXp(5);
      expect(p.getPendingXp()).toBe(15);
    });
  });

  describe('claimPendingXp', () => {
    it('transfiere pending a totalXp', () => {
      const p = new LoyaltyProfile({ conductorId, pendingXp: 50 });
      p.claimPendingXp(30);
      expect(p.getPendingXp()).toBe(20);
      expect(p.getTotalXp()).toBe(30);
    });

    it('lanza error si no hay suficiente pending', () => {
      const p = new LoyaltyProfile({ conductorId, pendingXp: 10 });
      expect(() => p.claimPendingXp(20)).toThrow(InvalidEntityDataException);
    });
  });

  describe('setLevel', () => {
    it('cambia el nivel', () => {
      const p = new LoyaltyProfile({ conductorId });
      p.setLevel('silver');
      expect(p.getLevel()).toBe('silver');
    });
  });

  describe('toProfile', () => {
    it('bronze con 0 XP → progress 0, xpForNextLevel 30', () => {
      const p = new LoyaltyProfile({ conductorId });
      const view = p.toProfile();
      expect(view.level).toBe('bronze');
      expect(view.totalXp).toBe(0);
      expect(view.pendingXp).toBe(0);
      expect(view.xpForNextLevel).toBe(30);
      expect(view.progress).toBe(0);
    });

    it('bronze con 15 XP → progress 50', () => {
      const p = new LoyaltyProfile({ conductorId, totalXp: 15 });
      const view = p.toProfile();
      expect(view.xpForNextLevel).toBe(15);
      expect(view.progress).toBe(50);
    });

    it('silver → xpForNextLevel hasta gold, progress calculado', () => {
      const p = new LoyaltyProfile({ conductorId, level: 'silver', totalXp: 65 });
      const view = p.toProfile();
      expect(view.level).toBe('silver');
      expect(view.xpForNextLevel).toBe(35);
      expect(view.progress).toBe(50);
    });

    it('platinum → xpForNextLevel null, progress 100', () => {
      const p = new LoyaltyProfile({ conductorId, level: 'platinum', totalXp: 300 });
      const view = p.toProfile();
      expect(view.level).toBe('platinum');
      expect(view.xpForNextLevel).toBeNull();
      expect(view.progress).toBe(100);
    });

    it('incluye benefits según el nivel', () => {
      const p = new LoyaltyProfile({ conductorId, level: 'silver', totalXp: 30 });
      const view = p.toProfile();
      expect(view.benefits.length).toBeGreaterThanOrEqual(1);
      expect(view.benefits.some(b => b.type === 'badge')).toBe(true);
    });
  });

  it('lanza error si conductorId no es UUID', () => {
    expect(() => new LoyaltyProfile({ conductorId: 'no-uuid' }))
      .toThrow(InvalidEntityDataException);
  });

  it('lanza error si level es inválido', () => {
    expect(() => new LoyaltyProfile({ conductorId, level: 'diamond' }))
      .toThrow(InvalidEntityDataException);
  });
});
