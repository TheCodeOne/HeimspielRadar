import { isTeamNumberMatch } from './use-matches';

describe('isTeamNumberMatch', () => {
  describe('exact team selection vs reserve teams', () => {
    it('matches first team when query is exact base name', () => {
      expect(
        isTeamNumberMatch('SpVgg Mössingen', 'Möss', undefined, 'SpVgg Mössingen', 'SpVgg Mössingen'),
      ).toBe(true);
    });

    it('rejects reserve team 2 when query is first team base name', () => {
      expect(
        isTeamNumberMatch('SpVgg Mössingen 2', 'Möss2', undefined, 'SpVgg Mössingen', 'SpVgg Mössingen'),
      ).toBe(false);
    });

    it('rejects reserve team 3 when query is first team base name', () => {
      expect(
        isTeamNumberMatch('SpVgg Mössingen 3', 'Möss3', undefined, 'SpVgg Mössingen', 'SpVgg Mössingen'),
      ).toBe(false);
    });

    it('matches reserve team 2 when query specifically requests team 2', () => {
      expect(
        isTeamNumberMatch('SpVgg Mössingen 2', 'Möss2', 2, 'SpVgg Mössingen', 'SpVgg Mössingen 2'),
      ).toBe(true);
    });

    it('rejects first team when query specifically requests team 2', () => {
      expect(
        isTeamNumberMatch('SpVgg Mössingen', 'Möss', 2, 'SpVgg Mössingen', 'SpVgg Mössingen 2'),
      ).toBe(false);
    });

    it('matches first team when query explicitly ends with 1', () => {
      expect(
        isTeamNumberMatch('SpVgg Mössingen', 'Möss', 1, 'SpVgg Mössingen', 'SpVgg Mössingen 1'),
      ).toBe(true);
    });

    it('rejects reserve team 2 when query explicitly ends with 1', () => {
      expect(
        isTeamNumberMatch('SpVgg Mössingen 2', 'Möss2', 1, 'SpVgg Mössingen', 'SpVgg Mössingen 1'),
      ).toBe(false);
    });
  });

  describe('club-level search queries without team specification', () => {
    it('allows both first and reserve teams when searching by club name', () => {
      expect(
        isTeamNumberMatch('SpVgg Mössingen', 'Möss', undefined, 'Mössingen', 'Mössingen'),
      ).toBe(true);
      expect(
        isTeamNumberMatch('SpVgg Mössingen 2', 'Möss2', undefined, 'Mössingen', 'Mössingen'),
      ).toBe(true);
    });

    it('disambiguates club name when number is appended (Mössingen 1 vs Mössingen 2)', () => {
      expect(
        isTeamNumberMatch('SpVgg Mössingen', 'Möss', 1, 'Mössingen', 'Mössingen 1'),
      ).toBe(true);
      expect(
        isTeamNumberMatch('SpVgg Mössingen 2', 'Möss2', 1, 'Mössingen', 'Mössingen 1'),
      ).toBe(false);
      expect(
        isTeamNumberMatch('SpVgg Mössingen', 'Möss', 2, 'Mössingen', 'Mössingen 2'),
      ).toBe(false);
      expect(
        isTeamNumberMatch('SpVgg Mössingen 2', 'Möss2', 2, 'Mössingen', 'Mössingen 2'),
      ).toBe(true);
    });
  });

  describe('composite queries with age class or gender', () => {
    it('matches first team and rejects reserve team for "MTV Stuttgart U12"', () => {
      expect(
        isTeamNumberMatch('MTV Stuttgart', 'MTV', undefined, 'MTV Stuttgart U12', 'MTV Stuttgart U12'),
      ).toBe(true);
      expect(
        isTeamNumberMatch('MTV Stuttgart 2', 'MTV2', undefined, 'MTV Stuttgart U12', 'MTV Stuttgart U12'),
      ).toBe(false);
    });
  });
});
