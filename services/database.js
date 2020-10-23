const config = require('../config.json')
const { Pool } = require('pg')

const quoteEscape = (value) => value.replace(/'/g, "''")

class DatabaseService {
    constructor () {
        this.pool = new Pool(config.database)
            .on('connect', () => {
                console.log('Connected to PostgreSQL database')
            })
            .on('error', (e) => console.error(e))
        this.users = []
        this.usersCaches = []
        this.usersTokens = []
    }

    query (query) {
        return new Promise((resolve) => {
            this.pool.query(query, (error, results) => {
                if (!error) resolve(results.rows)
                else console.error(error)
            })
        })
    }

    fetchUsers () {
        return new Promise((resolve) => {
            this.query(`
                SELECT * FROM users
            `).then((rows) => {
                this.users = rows.map((row) => {
                    return {
                        pronoteURL: row.pronote_url,
                        pronoteUsername: row.pronote_username,
                        pronotePassword: row.pronote_password,
                        pronoteCAS: row.pronote_cas,
                        avatarBase64: row.avatar_base64,
                        fullName: row.full_name,
                        studentClass: row.student_class,
                        establishment: row.establishment
                    }
                })
                resolve()
            })
        })
    }

    fetchCache () {
        return new Promise((resolve) => {
            this.query(`
                SELECT * FROM users_caches
            `).then((rows) => {
                this.usersCaches = rows.map((row) => {
                    return {
                        pronoteURL: row.pronote_url,
                        pronoteUsername: row.pronote_username,
                        homeworksCache: row.homeworks_cache,
                        marksCache: row.marks_cache
                    }
                })
                resolve()
            })
        })
    }

    fetchTokens () {
        return new Promise((resolve) => {
            this.query(`
                SELECT * FROM users_tokens
            `).then((rows) => {
                this.usersTokens = rows.map((row) => {
                    return {
                        pronoteURL: row.pronote_url,
                        pronoteUsername: row.pronote_username,
                        fcmToken: row.fcm_token,
                        createdAt: row.created_at,
                        isActive: row.is_active,
                        notificationsMarks: row.notifications_marks,
                        notificationsHomeworks: row.notifications_homeworks
                    }
                })
                resolve()
            })
        })
    }

    updateUserCache ({ pronoteUsername, pronoteURL }, { homeworksCache, marksCache }) {
        return new Promise((resolve) => {
            const homeworksCacheValue = quoteEscape(JSON.stringify(homeworksCache))
            const marksCacheValue = quoteEscape(JSON.stringify(marksCache))
            this.query(`
                INSERT INTO users_caches
                    (pronote_username, pronote_url, homeworks_cache, marks_cache) VALUES
                    ('${pronoteUsername}', '${pronoteURL}', '${homeworksCacheValue}', '${marksCacheValue}')
                ON CONFLICT ON CONSTRAINT users_caches_pkey DO
                    UPDATE SET homeworks_cache = excluded.homeworks_cache, marks_cache = excluded.marks_cache;
            `).then(() => {
                this.usersCaches = this.usersCaches.filter((cache) => {
                    return !(cache.pronoteUsername === pronoteUsername && cache.pronoteURL === pronoteURL)
                })
                this.usersCaches.push({
                    pronoteUsername,
                    pronoteURL,
                    homeworksCache,
                    marksCache
                })
                resolve()
            })
        })
    }

    updateUserPassword ({ pronoteUsername, pronoteURL, newPassword }) {
        return new Promise((resolve) => {
            this.query(`
                UPDATE users
                SET pronote_password = '${newPassword}'
                WHERE pronote_username = '${pronoteUsername}'
                AND pronote_url = '${pronoteURL}';
            `).then(() => {
                const existingUser = this.users.find((user) => {
                    return user.pronoteUsername === pronoteUsername && user.pronoteURL === pronoteURL
                })
                this.users = this.users.filter((user) => {
                    return !(user.pronoteUsername === pronoteUsername && user.pronoteURL === pronoteURL)
                })
                this.users.push({
                    ...existingUser,
                    ...{
                        pronotePassword: newPassword
                    }
                })
                resolve()
            })
        })
    }

    createUser ({ pronoteUsername, pronotePassword, pronoteURL, pronoteCAS, avatarBase64, fullName, studentClass, establishment }) {
        return new Promise((resolve) => {
            this.query(`
                INSERT INTO users
                (pronote_username, pronote_password, pronote_url, pronote_cas, avatar_base64, full_name, student_class, establishment) VALUES
                ('${pronoteUsername}', '${pronotePassword}', '${pronoteURL}', '${pronoteCAS}', '${avatarBase64}', '${fullName}', '${studentClass}', '${establishment}');
            `).then(() => {
                const user = {
                    pronoteUsername,
                    pronotePassword,
                    pronoteURL,
                    pronoteCAS,
                    avatarBase64,
                    fullName,
                    studentClass,
                    establishment
                }
                this.users.push(user)
                resolve(user)
            })
        })
    }

    updateToken (token, { notificationsHomeworks, notificationsMarks, isActive }) {
        return new Promise((resolve) => {
            const updates = []
            if (Object.prototype.hasOwnProperty.call(notificationsHomeworks)) updates.push(`notifications_homeworks = ${notificationsHomeworks}`)
            if (Object.prototype.hasOwnProperty.call(notificationsMarks)) updates.push(`notifications_marks = ${notificationsMarks}`)
            if (Object.prototype.hasOwnProperty.call(isActive)) updates.push(`is_active = ${isActive}`)
            this.query(`
                UPDATE users_tokens
                SET ${updates.join(', ')}
                WHERE fcm_token = '${token}';
            `).then(() => {
                const tokenData = this.usersTokens.find((t) => t.fcmToken === token)
                this.usersTokens = this.usersTokens.filter((t) => t.fcmToken !== token)
                const updatedTokenData = {
                    ...tokenData,
                    ...{
                        notificationsHomeworks,
                        notificationsMarks
                    }
                }
                this.usersTokens.push(updatedTokenData)
                resolve(updatedTokenData)
            })
        })
    }

    createOrUpdateToken ({ pronoteUsername, pronoteURL }, token) {
        return new Promise((resolve) => {
            this.query(`
                INSERT INTO users_tokens
                (pronote_username, pronote_url, fcm_token, is_active, notifications_homeworks, notifications_marks) VALUES
                ('${pronoteUsername}', '${pronoteURL}', '${token}', true, true, true)
                ON CONFLICT ON CONSTRAINT users_tokens_pkey DO
                    UPDATE SET pronote_username = excluded.pronote_username,
                    pronote_url = excluded.pronote_url,
                    is_active = true,
                    notifications_homeworks = true,
                    notifications_marks = true;
            `).then(() => {
                const userToken = {
                    pronoteUsername,
                    pronoteURL,
                    fcmToken: token,
                    isActive: true,
                    notificationsHomeworks: true,
                    notificationsMarks: true
                }
                this.usersTokens.push(userToken)
                resolve(userToken)
            })
        })
    }
};

module.exports = DatabaseService
