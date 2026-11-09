--宵刻刃－残夜
--Dusk Hour Blade - Lingering Night (original card)
local s,id=GetID()
local SET_YOIKOKU_BLADE=0x17c3
local CARD_POLAR_NIGHT=77700408
function s.initial_effect(c)
	c:EnableReviveLimit()
	--Synchro Summon: 1 Tuner + 1+ non-Tuner monsters
	Synchro.AddProcedure(c,nil,1,1,Synchro.NonTuner(nil),1,99)
	--① sent to the GY: Special Summon as many "Dusk Hour Blade" monsters from your hand/GY as possible
	local e1=Effect.CreateEffect(c)
	e1:SetDescription(aux.Stringid(id,0))
	e1:SetCategory(CATEGORY_SPECIAL_SUMMON)
	e1:SetType(EFFECT_TYPE_SINGLE+EFFECT_TYPE_TRIGGER_O)
	e1:SetProperty(EFFECT_FLAG_DELAY)
	e1:SetCode(EVENT_TO_GRAVE)
	e1:SetCountLimit(1,{id,0})
	e1:SetTarget(s.sptg)
	e1:SetOperation(s.spop)
	c:RegisterEffect(e1)
	--② either player's turn: target 1 "Dusk Hour Blade" monster on the field, destroy all opponent's cards in its column, return it to hand/Extra Deck
	c:RegisterEffect(s.column_effect(c,false))
	--"Dusk Hour Blade - Polar Night" with this card as material gains ② (Polar Night ①, once per turn under Polar Night's name)
	c:RegisterEffect(s.column_effect(c,true))
end
s.listed_series={SET_YOIKOKU_BLADE}
s.listed_names={CARD_POLAR_NIGHT}
function s.column_effect(c,xmat)
	local e=Effect.CreateEffect(c)
	e:SetDescription(aux.Stringid(id,1))
	e:SetCategory(CATEGORY_DESTROY+CATEGORY_TOHAND)
	e:SetCode(EVENT_FREE_CHAIN)
	e:SetProperty(EFFECT_FLAG_CARD_TARGET)
	e:SetHintTiming(0,TIMINGS_CHECK_MONSTER_E+TIMING_END_PHASE)
	if xmat then
		e:SetType(EFFECT_TYPE_XMATERIAL+EFFECT_TYPE_QUICK_O)
		e:SetCountLimit(1,{id,1})
		e:SetCondition(function(ef) local xc=ef:GetHandler() return xc:IsCode(CARD_POLAR_NIGHT) and not xc:IsDisabled() end)
	else
		e:SetType(EFFECT_TYPE_QUICK_O)
		e:SetRange(LOCATION_MZONE)
		e:SetCountLimit(1,{id,1})
	end
	e:SetTarget(s.cltg)
	e:SetOperation(s.clop)
	return e
end
function s.spfilter(c,e,tp)
	return c:IsSetCard(SET_YOIKOKU_BLADE) and c:IsMonster() and c:IsCanBeSpecialSummoned(e,0,tp,false,false)
end
function s.sptg(e,tp,eg,ep,ev,re,r,rp,chk)
	if chk==0 then return Duel.GetLocationCount(tp,LOCATION_MZONE)>0
		and Duel.IsExistingMatchingCard(s.spfilter,tp,LOCATION_HAND+LOCATION_GRAVE,0,1,nil,e,tp) end
	Duel.SetOperationInfo(0,CATEGORY_SPECIAL_SUMMON,nil,1,tp,LOCATION_HAND+LOCATION_GRAVE)
end
function s.spop(e,tp,eg,ep,ev,re,r,rp)
	local ft=Duel.GetLocationCount(tp,LOCATION_MZONE)
	if ft<=0 then return end
	if Duel.IsPlayerAffectedByEffect(tp,59822133) then ft=1 end
	local g=Duel.GetMatchingGroup(s.spfilter,tp,LOCATION_HAND+LOCATION_GRAVE,0,nil,e,tp)
	if #g==0 then return end
	local ct=math.min(ft,#g)
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_SPSUMMON)
	local sg=g:Select(tp,ct,ct,nil)
	Duel.SpecialSummon(sg,0,tp,tp,false,false,POS_FACEUP)
end
function s.clfilter(c)
	return c:IsFaceup() and c:IsSetCard(SET_YOIKOKU_BLADE) and c:IsAbleToHand()
end
function s.cltg(e,tp,eg,ep,ev,re,r,rp,chk,chkc)
	if chkc then return chkc:IsLocation(LOCATION_MZONE) and s.clfilter(chkc) end
	if chk==0 then return Duel.IsExistingTarget(s.clfilter,tp,LOCATION_MZONE,LOCATION_MZONE,1,nil) end
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_TARGET)
	local tc=Duel.SelectTarget(tp,s.clfilter,tp,LOCATION_MZONE,LOCATION_MZONE,1,1,nil):GetFirst()
	local dg=tc:GetColumnGroup():Filter(Card.IsControler,nil,1-tp)
	Duel.SetOperationInfo(0,CATEGORY_DESTROY,dg,#dg,0,0)
	Duel.SetOperationInfo(0,CATEGORY_TOHAND,tc,1,0,0)
end
function s.clop(e,tp,eg,ep,ev,re,r,rp)
	local tc=Duel.GetFirstTarget()
	if not tc or not tc:IsRelateToEffect(e) then return end
	local dg=tc:GetColumnGroup():Filter(Card.IsControler,nil,1-tp)
	if #dg>0 then Duel.Destroy(dg,REASON_EFFECT) end
	Duel.SendtoHand(tc,nil,REASON_EFFECT)
end
