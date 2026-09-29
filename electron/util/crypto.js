import bcrypt from 'bcryptjs'

// Single place for the bcrypt cost factor so admin and super-admin hashes stay
// consistent.
const COST = 10

export const hashPassword = (password) => bcrypt.hashSync(password, COST)
export const verifyPassword = (password, hash) => bcrypt.compareSync(password, hash)
