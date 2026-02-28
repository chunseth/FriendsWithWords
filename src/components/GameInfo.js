import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const GameInfo = ({
    wordCount,
    turnCount,
    tilesRemaining,
}) => (
    <View style={styles.container}>
        <View style={styles.row}>
            <View style={styles.infoItem}>
                <Text style={styles.label}>Words</Text>
                <Text style={styles.value}>{wordCount}</Text>
            </View>
            <View style={styles.infoItem}>
                <Text style={styles.label}>Turn</Text>
                <Text style={styles.value}>{turnCount}</Text>
            </View>
            <View style={styles.infoItem}>
                <Text style={styles.label}>Tiles</Text>
                <Text style={styles.value}>{tilesRemaining}</Text>
            </View>
        </View>
    </View>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    infoItem: {
        flex: 1,
        backgroundColor: 'white',
        borderRadius: 4,
        paddingVertical: 4,
        paddingHorizontal: 8,
        alignItems: 'center',
    },
    label: {
        fontSize: 10,
        fontWeight: '600',
        color: '#7f8c8d',
    },
    value: {
        color: '#2c3e50',
        fontSize: 14,
        fontWeight: '700',
    },
});

export default GameInfo;
