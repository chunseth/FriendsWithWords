import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

const WordHistory = ({ wordHistory }) => {
    const recentWords = wordHistory.slice(-10).reverse();
    
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Word History</Text>
            <ScrollView style={styles.history} showsVerticalScrollIndicator={true}>
                {recentWords.length === 0 ? (
                    <Text style={styles.empty}>No words yet</Text>
                ) : (
                    recentWords.map((item, index) => (
                        <View key={index} style={styles.historyItem}>
                            <Text style={styles.word}>{item.word}</Text>
                            <Text style={styles.score}>+{item.score}</Text>
                        </View>
                    ))
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f6f7',
        borderRadius: 8,
        padding: 10,
        maxHeight: 140,
    },
    title: {
        fontSize: 12,
        fontWeight: '600',
        color: '#2c3e50',
        marginBottom: 6,
    },
    history: {
        maxHeight: 100,
    },
    empty: {
        textAlign: 'center',
        color: '#7f8c8d',
        padding: 8,
        fontStyle: 'italic',
        fontSize: 12,
    },
    historyItem: {
        backgroundColor: 'white',
        padding: 6,
        borderRadius: 4,
        marginBottom: 4,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderLeftWidth: 2,
        borderLeftColor: '#667eea',
    },
    word: {
        fontWeight: '600',
        color: '#2c3e50',
        fontSize: 13,
    },
    score: {
        color: '#27ae60',
        fontWeight: '700',
        fontSize: 12,
    },
});

export default WordHistory;

