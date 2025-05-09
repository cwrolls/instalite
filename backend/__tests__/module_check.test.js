describe('Module Check', () => {
    it('should be able to require a module', () => {
      const path = require('path');
      expect(path).toBeDefined();
    });
  });