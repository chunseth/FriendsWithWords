import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';

const MessageOverlay = ({ message, onClose, isDarkMode = false }) => {
    const theme = isDarkMode ? DARK_THEME : LIGHT_THEME;
    const isWordAcceptedWithTurnPoints =
        message?.title === 'Word Accepted!' &&
        typeof message?.turnPoints === 'number';
    const isAnimatedWordAccepted =
        isWordAcceptedWithTurnPoints &&
        typeof message?.consistencyBonus === 'number' &&
        message.consistencyBonus > 0;

    const [displayPoints, setDisplayPoints] = useState({
        turnPoints: typeof message?.turnPoints === 'number' ? message.turnPoints : 0,
        bonusPoints: typeof message?.consistencyBonus === 'number' ? message.consistencyBonus : 0,
    });
    const [showBonusLabel, setShowBonusLabel] = useState(true);
    const animationTimeoutRef = useRef(null);
    const animationIntervalRef = useRef(null);
    const pointsRef = useRef({
        turnPoints: typeof message?.turnPoints === 'number' ? message.turnPoints : 0,
        bonusPoints: typeof message?.consistencyBonus === 'number' ? message.consistencyBonus : 0,
    });

    useEffect(() => {
        if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current);
        if (animationIntervalRef.current) clearInterval(animationIntervalRef.current);
        animationTimeoutRef.current = null;
        animationIntervalRef.current = null;

        const initialTurnPoints =
            typeof message?.turnPoints === 'number' ? message.turnPoints : 0;
        const initialBonusPoints =
            typeof message?.consistencyBonus === 'number' ? message.consistencyBonus : 0;

        setDisplayPoints({
            turnPoints: initialTurnPoints,
            bonusPoints: initialBonusPoints,
        });
        pointsRef.current = {
            turnPoints: initialTurnPoints,
            bonusPoints: initialBonusPoints,
        };
        setShowBonusLabel(true);

        if (!isAnimatedWordAccepted) {
            return undefined;
        }

        animationTimeoutRef.current = setTimeout(() => {
            setShowBonusLabel(false);
            animationIntervalRef.current = setInterval(() => {
                const { turnPoints, bonusPoints } = pointsRef.current;
                if (bonusPoints <= 0) {
                    if (animationIntervalRef.current) {
                        clearInterval(animationIntervalRef.current);
                        animationIntervalRef.current = null;
                    }
                    return;
                }

                const nextTurnPoints = turnPoints + 1;
                const nextBonusPoints = bonusPoints - 1;
                pointsRef.current = {
                    turnPoints: nextTurnPoints,
                    bonusPoints: nextBonusPoints,
                };
                setDisplayPoints({
                    turnPoints: nextTurnPoints,
                    bonusPoints: nextBonusPoints,
                });
            }, 60);
        }, 650);

        return () => {
            if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current);
            if (animationIntervalRef.current) clearInterval(animationIntervalRef.current);
        };
    }, [isAnimatedWordAccepted, message]);

    if (!message) return null;
    
    return (
        <Modal
            visible={!!message}
            transparent={true}
            animationType="none"
            onRequestClose={onClose}
        >
            <TouchableOpacity 
                style={styles.overlay} 
                activeOpacity={1}
                onPress={onClose}
            >
                <TouchableOpacity 
                    style={[
                        styles.content,
                        { backgroundColor: theme.contentBackground },
                    ]} 
                    activeOpacity={1}
                    onPress={(e) => e.stopPropagation()}
                >
                    <Text style={[styles.title, { color: theme.title }]}>{message.title}</Text>
                    {isWordAcceptedWithTurnPoints ? (
                        <>
                            <View style={styles.turnSummaryRow}>
                                <View style={styles.pointsLineRow}>
                                    <Text style={[styles.pointsLineText, { color: theme.body }]}>
                                        {displayPoints.turnPoints}
                                    </Text>
                                    {isAnimatedWordAccepted && displayPoints.bonusPoints > 0 && (
                                        <Text
                                            style={[
                                                styles.pointsLineBonusText,
                                                { color: theme.bonusText },
                                            ]}
                                        >
                                            {" "}+{displayPoints.bonusPoints}
                                        </Text>
                                    )}
                                    <Text style={[styles.pointsLineText, { color: theme.body }]}> points</Text>
                                </View>
                                <View style={styles.comboRow}>
                                    <Text style={[styles.comboLabel, { color: theme.bonusText }]}>
                                        {isAnimatedWordAccepted && showBonusLabel ? 'Combo!' : ' '}
                                    </Text>
                                </View>
                            </View>
                            {typeof message?.scrabbleBonusMessage === 'string' &&
                                message.scrabbleBonusMessage.length > 0 && (
                                    <Text style={[styles.bonusMessageText, { color: theme.bonusText }]}>
                                        {message.scrabbleBonusMessage}
                                    </Text>
                                )}
                            <Text style={[styles.text, { color: theme.body }]}>{message.text}</Text>
                        </>
                    ) : (
                        <Text style={[styles.text, { color: theme.body }]}>{message.text}</Text>
                    )}
                    <TouchableOpacity
                        style={[styles.button, { backgroundColor: theme.buttonBackground }]}
                        onPress={onClose}
                    >
                        <Text style={styles.buttonText}>OK</Text>
                    </TouchableOpacity>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );
};

const LIGHT_THEME = {
    contentBackground: 'white',
    title: '#2c3e50',
    body: '#7f8c8d',
    bonusText: '#2f6f4f',
    buttonBackground: '#667eea',
};

const DARK_THEME = {
    contentBackground: '#1a2431',
    title: '#f8fafc',
    body: '#cbd5e1',
    bonusText: '#86efac',
    buttonBackground: '#4f46e5',
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    content: {
        backgroundColor: 'white',
        borderRadius: 15,
        padding: 30,
        maxWidth: 400,
        width: '100%',
        alignItems: 'center',
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#2c3e50',
        marginBottom: 15,
    },
    text: {
        fontSize: 16,
        color: '#7f8c8d',
        marginBottom: 20,
        textAlign: 'center',
        lineHeight: 22,
    },
    turnSummaryRow: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
    },
    pointsLineRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    pointsLineText: {
        fontSize: 16,
        color: '#7f8c8d',
        lineHeight: 22,
    },
    pointsLineBonusText: {
        fontSize: 16,
        color: '#2f6f4f',
        lineHeight: 22,
    },
    comboRow: {
        minHeight: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    comboLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#2f6f4f',
    },
    bonusMessageText: {
        fontSize: 13,
        fontWeight: '700',
        marginBottom: 8,
        textAlign: 'center',
    },
    button: {
        backgroundColor: '#667eea',
        borderRadius: 8,
        padding: 12,
        minWidth: 100,
        alignItems: 'center',
    },
    buttonText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 16,
    },
});

export default MessageOverlay;
