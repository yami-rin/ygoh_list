// Data Storage Optimization Module
// Version: 2.0.0
// Purpose: Centralized, validated, and optimized data storage management

class DataStorageManager {
    constructor() {
        this.STORAGE_KEYS = {
            BATTLE_RECORDS: 'battleRecords',
            TOURNAMENT_PROGRESS: 'tournamentProgress',
            TOURNAMENT_PRESETS: 'tournamentPresets',
            STORES: 'stores',
            SETTINGS: 'appSettings',
            DATA_VERSION: 'dataVersion'
        };
        
        this.CURRENT_VERSION = '2.0.0';
        this.cache = {};
        this.isDirty = {};
    }

    // Initialize and migrate data if needed
    async initialize() {
        try {
            const version = localStorage.getItem(this.STORAGE_KEYS.DATA_VERSION);
            if (!version || version < this.CURRENT_VERSION) {
                await this.migrateData(version);
            }
            this.validateAllData();
            return true;
        } catch (error) {
            console.error('Failed to initialize storage:', error);
            return false;
        }
    }

    // Data validation schema
    validateRecord(record) {
        const errors = [];
        
        // Required fields
        if (!record.id) errors.push('Missing record ID');
        if (!record.date || !this.isValidDate(record.date)) errors.push('Invalid date');
        if (!record.myDeck) errors.push('Missing deck information');
        
        // Data type validation
        if (record.timestamp && typeof record.timestamp !== 'number') {
            errors.push('Invalid timestamp type');
        }
        
        // Enum validation
        const validResults = ['勝ち', '負け', '引き分け', 'win', 'lose', 'draw'];
        if (record.result && !validResults.includes(record.result)) {
            errors.push('Invalid result value');
        }
        
        return errors.length === 0 ? null : errors;
    }

    // Centralized save operation with validation
    saveRecord(record) {
        // Validate before saving
        const errors = this.validateRecord(record);
        if (errors) {
            console.error('Validation failed:', errors);
            throw new Error(`Validation failed: ${errors.join(', ')}`);
        }

        // Normalize data structure
        const normalizedRecord = this.normalizeRecord(record);
        
        // Get existing records
        const records = this.getRecords();
        
        // Check for duplicates
        const existingIndex = records.findIndex(r => r.id === normalizedRecord.id);
        
        if (existingIndex !== -1) {
            // Update existing
            records[existingIndex] = normalizedRecord;
        } else {
            // Add new
            records.push(normalizedRecord);
        }
        
        // Save with error handling
        return this.saveToStorage(this.STORAGE_KEYS.BATTLE_RECORDS, records);
    }

    // Normalize record structure
    normalizeRecord(record) {
        return {
            id: record.id || this.generateId(),
            date: record.date,
            tournament: record.tournament || '通常対戦',
            store: record.store || '',
            round: record.round || null,
            myDeck: record.myDeck || record.deck, // Handle legacy field
            opponentName: record.opponentName || record.opponent || '',
            opponentDeck: record.opponentDeck || '',
            result: record.result || record.gameResult || '',
            matchFormat: record.matchFormat || 'single',
            choice: record.choice || null,
            first: record.first || null,
            notes: record.notes || '',
            timestamp: record.timestamp || Date.now(),
            isMasterDuel: Boolean(record.isMasterDuel),
            regulation: record.regulation || null,
            gameResults: record.gameResults || [],
            gameFirstChoices: record.gameFirstChoices || [],
            userId: record.userId || null
        };
    }

    // Optimized batch operations
    saveRecordsBatch(records) {
        const normalizedRecords = records.map(r => {
            const errors = this.validateRecord(r);
            if (errors) {
                console.warn(`Skipping invalid record ${r.id}:`, errors);
                return null;
            }
            return this.normalizeRecord(r);
        }).filter(r => r !== null);
        
        return this.saveToStorage(this.STORAGE_KEYS.BATTLE_RECORDS, normalizedRecords);
    }

    // Get records with caching
    getRecords(forceRefresh = false) {
        const cacheKey = this.STORAGE_KEYS.BATTLE_RECORDS;
        
        if (!forceRefresh && this.cache[cacheKey] && !this.isDirty[cacheKey]) {
            return this.cache[cacheKey];
        }
        
        const records = this.loadFromStorage(cacheKey, []);
        this.cache[cacheKey] = records;
        this.isDirty[cacheKey] = false;
        
        return records;
    }

    // Delete record with validation
    deleteRecord(recordId) {
        const records = this.getRecords();
        const filteredRecords = records.filter(r => r.id !== recordId);
        
        if (records.length === filteredRecords.length) {
            console.warn(`Record ${recordId} not found`);
            return false;
        }
        
        return this.saveToStorage(this.STORAGE_KEYS.BATTLE_RECORDS, filteredRecords);
    }

    // Delete tournament with all related records
    deleteTournament(tournamentName, date, deck) {
        const records = this.getRecords();
        const filteredRecords = records.filter(r => 
            !(r.tournament === tournamentName && 
              r.date === date && 
              r.myDeck === deck)
        );
        
        const deletedCount = records.length - filteredRecords.length;
        console.log(`Deleted ${deletedCount} records for tournament ${tournamentName}`);
        
        return this.saveToStorage(this.STORAGE_KEYS.BATTLE_RECORDS, filteredRecords);
    }

    // Tournament progress management
    saveTournamentProgress(progress) {
        if (!progress || !progress.tournament) {
            throw new Error('Invalid tournament progress data');
        }
        
        return this.saveToStorage(this.STORAGE_KEYS.TOURNAMENT_PROGRESS, progress);
    }

    getTournamentProgress() {
        return this.loadFromStorage(this.STORAGE_KEYS.TOURNAMENT_PROGRESS, null);
    }

    clearTournamentProgress() {
        localStorage.removeItem(this.STORAGE_KEYS.TOURNAMENT_PROGRESS);
        delete this.cache[this.STORAGE_KEYS.TOURNAMENT_PROGRESS];
        return true;
    }

    // Settings management
    saveSettings(settings) {
        const currentSettings = this.getSettings();
        const mergedSettings = { ...currentSettings, ...settings };
        return this.saveToStorage(this.STORAGE_KEYS.SETTINGS, mergedSettings);
    }

    getSettings() {
        return this.loadFromStorage(this.STORAGE_KEYS.SETTINGS, {
            darkMode: false,
            masterDuelMode: false,
            showStatisticsFilter: false,
            tweetTemplate: '',
            isLocalMode: true
        });
    }

    // Store management
    getStores() {
        // Get from dedicated storage
        const savedStores = this.loadFromStorage(this.STORAGE_KEYS.STORES, []);
        
        // Extract from records for backward compatibility
        const recordStores = new Set();
        this.getRecords().forEach(r => {
            if (r.store) recordStores.add(r.store);
        });
        
        // Merge and deduplicate
        const allStores = new Set([...savedStores, ...recordStores]);
        return Array.from(allStores).sort();
    }

    saveStore(storeName) {
        if (!storeName || typeof storeName !== 'string') return false;
        
        const stores = this.getStores();
        if (!stores.includes(storeName)) {
            stores.push(storeName);
            stores.sort();
            return this.saveToStorage(this.STORAGE_KEYS.STORES, stores);
        }
        return true;
    }

    // Preset management
    getPresets() {
        return this.loadFromStorage(this.STORAGE_KEYS.TOURNAMENT_PRESETS, []);
    }

    savePreset(preset) {
        if (!preset.name) {
            throw new Error('Preset must have a name');
        }
        
        const presets = this.getPresets();
        const existingIndex = presets.findIndex(p => p.name === preset.name);
        
        if (existingIndex !== -1) {
            presets[existingIndex] = preset;
        } else {
            presets.push(preset);
        }
        
        return this.saveToStorage(this.STORAGE_KEYS.TOURNAMENT_PRESETS, presets);
    }

    deletePreset(presetName) {
        const presets = this.getPresets();
        const filtered = presets.filter(p => p.name !== presetName);
        return this.saveToStorage(this.STORAGE_KEYS.TOURNAMENT_PRESETS, filtered);
    }

    // Export/Import functionality
    exportData(options = {}) {
        const data = {
            version: this.CURRENT_VERSION,
            exportDate: new Date().toISOString(),
            data: {}
        };
        
        if (options.includeRecords !== false) {
            data.data.records = this.getRecords();
        }
        
        if (options.includeSettings) {
            data.data.settings = this.getSettings();
        }
        
        if (options.includePresets) {
            data.data.presets = this.getPresets();
        }
        
        if (options.includeStores) {
            data.data.stores = this.getStores();
        }
        
        return JSON.stringify(data, null, 2);
    }

    async importData(jsonString, options = {}) {
        try {
            const imported = JSON.parse(jsonString);
            
            if (!imported.version || !imported.data) {
                throw new Error('Invalid import file format');
            }
            
            // Import records
            if (imported.data.records && options.importRecords !== false) {
                const validRecords = imported.data.records.filter(r => {
                    const errors = this.validateRecord(r);
                    if (errors) {
                        console.warn('Skipping invalid record during import:', errors);
                        return false;
                    }
                    return true;
                });
                
                if (options.mergeRecords) {
                    const existing = this.getRecords();
                    const merged = [...existing];
                    
                    validRecords.forEach(record => {
                        if (!existing.find(r => r.id === record.id)) {
                            merged.push(this.normalizeRecord(record));
                        }
                    });
                    
                    this.saveToStorage(this.STORAGE_KEYS.BATTLE_RECORDS, merged);
                } else {
                    this.saveRecordsBatch(validRecords);
                }
            }
            
            // Import other data
            if (imported.data.settings && options.importSettings) {
                this.saveSettings(imported.data.settings);
            }
            
            if (imported.data.presets && options.importPresets) {
                imported.data.presets.forEach(preset => this.savePreset(preset));
            }
            
            if (imported.data.stores && options.importStores) {
                imported.data.stores.forEach(store => this.saveStore(store));
            }
            
            return true;
        } catch (error) {
            console.error('Import failed:', error);
            throw error;
        }
    }

    // Tournament data extraction
    getTournamentList() {
        const records = this.getRecords();
        const tournaments = new Map();
        
        records.forEach(record => {
            if (record.tournament && record.tournament !== '通常対戦') {
                const key = `${record.tournament}_${record.date}_${record.myDeck}`;
                
                if (!tournaments.has(key)) {
                    tournaments.set(key, {
                        id: key,
                        name: record.tournament,
                        date: record.date,
                        store: record.store || '',
                        deck: record.myDeck,
                        rounds: [],
                        totalRounds: 0
                    });
                }
                
                const tournament = tournaments.get(key);
                tournament.rounds.push(record);
                
                // Update total rounds
                const roundNum = parseInt(record.round?.replace('R', '') || '0');
                if (roundNum > tournament.totalRounds) {
                    tournament.totalRounds = roundNum;
                }
            }
        });
        
        return Array.from(tournaments.values()).sort((a, b) => 
            new Date(b.date) - new Date(a.date)
        );
    }

    // Statistics calculation
    calculateStatistics(filters = {}) {
        const records = this.getRecords();
        let filtered = records;
        
        // Apply filters
        if (filters.dateFrom) {
            filtered = filtered.filter(r => r.date >= filters.dateFrom);
        }
        
        if (filters.dateTo) {
            filtered = filtered.filter(r => r.date <= filters.dateTo);
        }
        
        if (filters.deck) {
            filtered = filtered.filter(r => r.myDeck === filters.deck);
        }
        
        if (filters.tournament) {
            filtered = filtered.filter(r => r.tournament === filters.tournament);
        }
        
        // Calculate stats
        const stats = {
            total: filtered.length,
            wins: filtered.filter(r => ['勝ち', 'win'].includes(r.result)).length,
            losses: filtered.filter(r => ['負け', 'lose'].includes(r.result)).length,
            draws: filtered.filter(r => ['引き分け', 'draw'].includes(r.result)).length
        };
        
        stats.winRate = stats.total > 0 ? 
            ((stats.wins / stats.total) * 100).toFixed(1) : 0;
        
        // Deck usage statistics
        const deckStats = {};
        filtered.forEach(r => {
            if (!deckStats[r.myDeck]) {
                deckStats[r.myDeck] = { total: 0, wins: 0, losses: 0, draws: 0 };
            }
            deckStats[r.myDeck].total++;
            
            if (['勝ち', 'win'].includes(r.result)) {
                deckStats[r.myDeck].wins++;
            } else if (['負け', 'lose'].includes(r.result)) {
                deckStats[r.myDeck].losses++;
            } else if (['引き分け', 'draw'].includes(r.result)) {
                deckStats[r.myDeck].draws++;
            }
        });
        
        stats.byDeck = deckStats;
        
        return stats;
    }

    // Utility functions
    generateId() {
        return Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9);
    }

    isValidDate(dateString) {
        const regex = /^\d{4}-\d{2}-\d{2}$/;
        if (!regex.test(dateString)) return false;
        
        const date = new Date(dateString);
        return date instanceof Date && !isNaN(date);
    }

    // Core storage operations with error handling
    saveToStorage(key, data) {
        try {
            const serialized = JSON.stringify(data);
            localStorage.setItem(key, serialized);
            this.cache[key] = data;
            this.isDirty[key] = false;
            return true;
        } catch (error) {
            if (error.name === 'QuotaExceededError') {
                console.error('Storage quota exceeded');
                // Try to clean up old data
                this.cleanupOldData();
                // Retry once
                try {
                    localStorage.setItem(key, JSON.stringify(data));
                    return true;
                } catch (retryError) {
                    console.error('Failed to save after cleanup:', retryError);
                    return false;
                }
            }
            console.error('Failed to save to storage:', error);
            return false;
        }
    }

    loadFromStorage(key, defaultValue) {
        try {
            const data = localStorage.getItem(key);
            if (data === null) return defaultValue;
            
            const parsed = JSON.parse(data);
            this.cache[key] = parsed;
            this.isDirty[key] = false;
            return parsed;
        } catch (error) {
            console.error(`Failed to load ${key} from storage:`, error);
            // Return default value on error
            return defaultValue;
        }
    }

    // Data migration for version updates
    async migrateData(fromVersion) {
        console.log(`Migrating data from version ${fromVersion || 'unknown'} to ${this.CURRENT_VERSION}`);
        
        try {
            // Backup current data
            const backup = this.exportData({ 
                includeRecords: true, 
                includeSettings: true, 
                includePresets: true, 
                includeStores: true 
            });
            localStorage.setItem('dataBackup_' + Date.now(), backup);
            
            // Get existing data
            const records = this.loadFromStorage(this.STORAGE_KEYS.BATTLE_RECORDS, []);
            
            // Migrate records
            const migratedRecords = records.map(record => {
                // Fix deck/myDeck inconsistency
                if (record.deck && !record.myDeck) {
                    record.myDeck = record.deck;
                }
                delete record.deck; // Remove duplicate field
                
                // Ensure ID exists
                if (!record.id) {
                    record.id = this.generateId();
                }
                
                // Ensure timestamp exists
                if (!record.timestamp) {
                    record.timestamp = new Date(record.date).getTime() || Date.now();
                }
                
                // Normalize result values
                if (record.result === '勝ち' || record.result === 'win') {
                    record.result = '勝ち';
                } else if (record.result === '負け' || record.result === 'lose') {
                    record.result = '負け';
                } else if (record.result === '引き分け' || record.result === 'draw') {
                    record.result = '引き分け';
                }
                
                return this.normalizeRecord(record);
            });
            
            // Save migrated data
            this.saveToStorage(this.STORAGE_KEYS.BATTLE_RECORDS, migratedRecords);
            
            // Update version
            localStorage.setItem(this.STORAGE_KEYS.DATA_VERSION, this.CURRENT_VERSION);
            
            console.log('Data migration completed successfully');
            return true;
        } catch (error) {
            console.error('Data migration failed:', error);
            return false;
        }
    }

    // Cleanup old data to free up space
    cleanupOldData() {
        try {
            // Remove old backups (keep only last 3)
            const backupKeys = Object.keys(localStorage)
                .filter(key => key.startsWith('dataBackup_'))
                .sort()
                .reverse();
            
            if (backupKeys.length > 3) {
                backupKeys.slice(3).forEach(key => {
                    localStorage.removeItem(key);
                    console.log(`Removed old backup: ${key}`);
                });
            }
            
            // Clear cache
            this.cache = {};
            this.isDirty = {};
            
            return true;
        } catch (error) {
            console.error('Cleanup failed:', error);
            return false;
        }
    }

    // Validate all stored data
    validateAllData() {
        const records = this.getRecords();
        let invalidCount = 0;
        
        records.forEach((record, index) => {
            const errors = this.validateRecord(record);
            if (errors) {
                console.warn(`Invalid record at index ${index}:`, errors, record);
                invalidCount++;
            }
        });
        
        if (invalidCount > 0) {
            console.warn(`Found ${invalidCount} invalid records out of ${records.length}`);
        } else {
            console.log(`All ${records.length} records are valid`);
        }
        
        return invalidCount === 0;
    }

    // Clear all data (with confirmation)
    clearAllData(confirm = false) {
        if (!confirm) {
            console.error('Clear all data requires confirmation');
            return false;
        }
        
        // Create backup first
        const backup = this.exportData({ 
            includeRecords: true, 
            includeSettings: true, 
            includePresets: true, 
            includeStores: true 
        });
        localStorage.setItem('dataBackup_beforeClear_' + Date.now(), backup);
        
        // Clear all managed keys
        Object.values(this.STORAGE_KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
        
        // Clear cache
        this.cache = {};
        this.isDirty = {};
        
        console.log('All data cleared (backup created)');
        return true;
    }
}

// Export for use in main application
window.DataStorageManager = DataStorageManager;