// Storage Integration Module
// Provides wrapper functions to integrate DataStorageManager with existing code

// Load records with mode handling
async function loadRecordsOptimized() {
    try {
        if (isLocalMode) {
            // Use storage manager for local mode
            battleRecords = storageManager.getRecords();
        } else {
            // Keep Firebase logic for cloud mode
            const q = query(collection(db, 'battleRecords'), where('userId', '==', currentUser.uid));
            const snapshot = await getDocs(q);
            battleRecords = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        }
        
        // Filter based on Master Duel mode
        battleRecords = battleRecords.filter(record => {
            if (isMasterDuelMode) {
                return record.isMasterDuel === true;
            } else {
                return !record.isMasterDuel;
            }
        });
        
        // Sort records
        battleRecords.sort((a, b) => {
            const dateCompare = new Date(b.date) - new Date(a.date);
            if (dateCompare !== 0) return dateCompare;
            
            if (a.tournament && b.tournament) {
                const tournamentCompare = a.tournament.localeCompare(b.tournament);
                if (tournamentCompare !== 0) return tournamentCompare;
            }
            
            const roundA = parseInt(a.round?.replace('R', '') || '0');
            const roundB = parseInt(b.round?.replace('R', '') || '0');
            return roundA - roundB;
        });
        
        filteredRecords = [...battleRecords];
        displayBattleRecords();
        updateStatistics();
        
        // Check for tournament in progress
        const progress = storageManager.getTournamentProgress();
        if (progress) {
            document.getElementById('resume-tournament-btn').style.display = 'block';
        } else {
            document.getElementById('resume-tournament-btn').style.display = 'none';
        }
        
    } catch (error) {
        console.error('Error loading records:', error);
        showAlert('データの読み込みに失敗しました', 'danger');
    }
}

// Save a single record
async function saveRecordOptimized(record) {
    try {
        // Normalize the record
        const normalizedRecord = {
            ...record,
            id: record.id || storageManager.generateId(),
            myDeck: record.myDeck || record.deck,
            timestamp: record.timestamp || Date.now()
        };
        
        if (isLocalMode) {
            // Use storage manager for local mode
            const success = storageManager.saveRecord(normalizedRecord);
            if (!success) {
                throw new Error('Failed to save record');
            }
            battleRecords = storageManager.getRecords();
        } else {
            // Firebase mode
            if (normalizedRecord.id && !normalizedRecord.id.startsWith('local_')) {
                await updateDoc(doc(db, 'battleRecords', normalizedRecord.id), normalizedRecord);
            } else {
                normalizedRecord.userId = currentUser.uid;
                const docRef = await addDoc(collection(db, 'battleRecords'), normalizedRecord);
                normalizedRecord.id = docRef.id;
            }
            
            // Update local array
            const index = battleRecords.findIndex(r => r.id === normalizedRecord.id);
            if (index !== -1) {
                battleRecords[index] = normalizedRecord;
            } else {
                battleRecords.push(normalizedRecord);
            }
        }
        
        return true;
    } catch (error) {
        console.error('Error saving record:', error);
        return false;
    }
}

// Delete a record
async function deleteRecordOptimized(recordId) {
    try {
        if (isLocalMode) {
            const success = storageManager.deleteRecord(recordId);
            if (success) {
                battleRecords = storageManager.getRecords();
            }
            return success;
        } else {
            await deleteDoc(doc(db, 'battleRecords', recordId));
            battleRecords = battleRecords.filter(r => r.id !== recordId);
            return true;
        }
    } catch (error) {
        console.error('Error deleting record:', error);
        return false;
    }
}

// Delete entire tournament
async function deleteTournamentOptimized(tournamentName, date, deck) {
    try {
        if (isLocalMode) {
            const success = storageManager.deleteTournament(tournamentName, date, deck);
            if (success) {
                battleRecords = storageManager.getRecords();
            }
            return success;
        } else {
            // Firebase mode
            const toDelete = battleRecords.filter(r => 
                r.tournament === tournamentName && 
                r.date === date && 
                r.myDeck === deck
            );
            
            for (const record of toDelete) {
                await deleteDoc(doc(db, 'battleRecords', record.id));
            }
            
            battleRecords = battleRecords.filter(r => 
                !(r.tournament === tournamentName && r.date === date && r.myDeck === deck)
            );
            
            return true;
        }
    } catch (error) {
        console.error('Error deleting tournament:', error);
        return false;
    }
}

// Save tournament progress
function saveTournamentProgressOptimized(progress) {
    try {
        return storageManager.saveTournamentProgress(progress);
    } catch (error) {
        console.error('Error saving tournament progress:', error);
        return false;
    }
}

// Load tournament progress
function loadTournamentProgressOptimized() {
    try {
        const progress = storageManager.getTournamentProgress();
        if (progress && progress.tournament) {
            currentTournament = progress.tournament;
            savedRounds = progress.savedRounds || {};
            tournamentProgress = progress;
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error loading tournament progress:', error);
        return false;
    }
}

// Clear tournament progress
function clearTournamentProgressOptimized() {
    try {
        return storageManager.clearTournamentProgress();
    } catch (error) {
        console.error('Error clearing tournament progress:', error);
        return false;
    }
}

// Save stores
function saveStoresOptimized() {
    try {
        stores.forEach(store => {
            storageManager.saveStore(store);
        });
        return true;
    } catch (error) {
        console.error('Error saving stores:', error);
        return false;
    }
}

// Load stores
function loadStoresOptimized() {
    try {
        stores = storageManager.getStores();
        return true;
    } catch (error) {
        console.error('Error loading stores:', error);
        stores = [];
        return false;
    }
}

// Save presets
function savePresetsOptimized() {
    try {
        // Clear existing presets
        const existingPresets = storageManager.getPresets();
        existingPresets.forEach(p => storageManager.deletePreset(p.name));
        
        // Save new presets
        presets.forEach(preset => {
            storageManager.savePreset(preset);
        });
        return true;
    } catch (error) {
        console.error('Error saving presets:', error);
        return false;
    }
}

// Load presets
function loadPresetsOptimized() {
    try {
        presets = storageManager.getPresets();
        return true;
    } catch (error) {
        console.error('Error loading presets:', error);
        presets = [];
        return false;
    }
}

// Get tournament list
function getTournamentListOptimized() {
    try {
        return storageManager.getTournamentList();
    } catch (error) {
        console.error('Error getting tournament list:', error);
        return [];
    }
}

// Export tournament data
function exportTournamentDataOptimized(tournamentId) {
    try {
        const tournaments = storageManager.getTournamentList();
        const tournament = tournaments.find(t => t.id === tournamentId);
        
        if (!tournament) {
            throw new Error('Tournament not found');
        }
        
        const exportData = {
            version: '2.0.0',
            exportDate: new Date().toISOString(),
            tournament: {
                name: tournament.name,
                date: tournament.date,
                store: tournament.store,
                deck: tournament.deck,
                totalRounds: tournament.totalRounds
            },
            records: tournament.rounds
        };
        
        return JSON.stringify(exportData, null, 2);
    } catch (error) {
        console.error('Error exporting tournament:', error);
        return null;
    }
}

// Import tournament data
async function importTournamentDataOptimized(jsonData) {
    try {
        const data = JSON.parse(jsonData);
        
        if (!data.tournament || !data.records) {
            throw new Error('Invalid import format');
        }
        
        // Check for duplicates
        const existingTournament = storageManager.getTournamentList().find(t => 
            t.name === data.tournament.name && 
            t.date === data.tournament.date
        );
        
        if (existingTournament) {
            if (!confirm('同じ大会のデータが既に存在します。上書きしますか？')) {
                return false;
            }
            
            // Delete existing tournament
            await deleteTournamentOptimized(
                data.tournament.name, 
                data.tournament.date, 
                data.tournament.deck
            );
        }
        
        // Import records
        for (const record of data.records) {
            // Generate new ID for imported records
            record.id = storageManager.generateId();
            await saveRecordOptimized(record);
        }
        
        return true;
    } catch (error) {
        console.error('Error importing tournament:', error);
        return false;
    }
}

// Save settings
function saveSettingsOptimized() {
    try {
        const settings = {
            darkMode: document.body.getAttribute('data-bs-theme') === 'dark',
            masterDuelMode: isMasterDuelMode,
            showStatisticsFilter: document.getElementById('show-statistics-filter')?.checked || false,
            tweetTemplate: document.getElementById('tweet-template')?.value || '',
            isLocalMode: isLocalMode
        };
        
        return storageManager.saveSettings(settings);
    } catch (error) {
        console.error('Error saving settings:', error);
        return false;
    }
}

// Load settings
function loadSettingsOptimized() {
    try {
        const settings = storageManager.getSettings();
        
        // Apply settings
        if (settings.darkMode) {
            document.body.setAttribute('data-bs-theme', 'dark');
        }
        
        isMasterDuelMode = settings.masterDuelMode;
        isLocalMode = settings.isLocalMode;
        
        if (document.getElementById('show-statistics-filter')) {
            document.getElementById('show-statistics-filter').checked = settings.showStatisticsFilter;
        }
        
        if (document.getElementById('tweet-template')) {
            document.getElementById('tweet-template').value = settings.tweetTemplate || '';
        }
        
        return true;
    } catch (error) {
        console.error('Error loading settings:', error);
        return false;
    }
}

// Calculate statistics
function calculateStatisticsOptimized(filters = {}) {
    try {
        return storageManager.calculateStatistics(filters);
    } catch (error) {
        console.error('Error calculating statistics:', error);
        return {
            total: 0,
            wins: 0,
            losses: 0,
            draws: 0,
            winRate: 0,
            byDeck: {}
        };
    }
}

// Export all data
function exportAllDataOptimized() {
    try {
        return storageManager.exportData({
            includeRecords: true,
            includeSettings: true,
            includePresets: true,
            includeStores: true
        });
    } catch (error) {
        console.error('Error exporting all data:', error);
        return null;
    }
}

// Import all data
async function importAllDataOptimized(jsonData, options = {}) {
    try {
        const success = await storageManager.importData(jsonData, {
            importRecords: options.importRecords !== false,
            importSettings: options.importSettings || false,
            importPresets: options.importPresets || false,
            importStores: options.importStores || false,
            mergeRecords: options.mergeRecords || false
        });
        
        if (success) {
            // Reload data
            await loadRecordsOptimized();
            loadStoresOptimized();
            loadPresetsOptimized();
            loadSettingsOptimized();
        }
        
        return success;
    } catch (error) {
        console.error('Error importing all data:', error);
        return false;
    }
}