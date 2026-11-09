--凋落の虚像－アイドル
--Decline Idol (original card)
local s,id=GetID()
local SET_DECLINE=0x7c0
function s.initial_effect(c)
	--can be Tribute Summoned by Tributing 1 Tribute Summoned monster
	aux.AddNormalSummonProcedure(c,true,true,1,1,SUMMON_TYPE_TRIBUTE,aux.Stringid(id,0),s.otfilter)
	aux.AddNormalSetProcedure(c,true,true,1,1,SUMMON_TYPE_TRIBUTE,aux.Stringid(id,0),s.otfilter)
	--① if Tribute Summoned: unaffected by other cards' effects
	local e1=Effect.CreateEffect(c)
	e1:SetType(EFFECT_TYPE_SINGLE)
	e1:SetProperty(EFFECT_FLAG_SINGLE_RANGE)
	e1:SetRange(LOCATION_MZONE)
	e1:SetCode(EFFECT_IMMUNE_EFFECT)
	e1:SetCondition(function(e) return e:GetHandler():IsSummonType(SUMMON_TYPE_TRIBUTE) end)
	e1:SetValue(function(e,te) return te:GetOwner()~=e:GetOwner() end)
	c:RegisterEffect(e1)
	--② shuffle this card from hand into the Deck: Normal Summon a "Decline" monster from the Deck
	local e2=Effect.CreateEffect(c)
	e2:SetDescription(aux.Stringid(id,1))
	e2:SetCategory(CATEGORY_SUMMON)
	e2:SetType(EFFECT_TYPE_IGNITION)
	e2:SetRange(LOCATION_HAND)
	e2:SetCost(s.tdcost)
	e2:SetTarget(s.sumtg)
	e2:SetOperation(s.sumop)
	c:RegisterEffect(e2)
	--③ Tribute Summoned: banish all opponent's monsters whose ATK is below their original ATK
	local e3=Effect.CreateEffect(c)
	e3:SetDescription(aux.Stringid(id,2))
	e3:SetCategory(CATEGORY_REMOVE)
	e3:SetType(EFFECT_TYPE_SINGLE+EFFECT_TYPE_TRIGGER_O)
	e3:SetCode(EVENT_SUMMON_SUCCESS)
	e3:SetCondition(function(e) return e:GetHandler():IsSummonType(SUMMON_TYPE_TRIBUTE) end)
	e3:SetTarget(s.rmtg)
	e3:SetOperation(s.rmop)
	c:RegisterEffect(e3)
end
s.listed_series={SET_DECLINE}
function s.otfilter(c,tp)
	return c:IsSummonType(SUMMON_TYPE_TRIBUTE) and (c:IsControler(tp) or c:IsFaceup())
end
function s.tdcost(e,tp,eg,ep,ev,re,r,rp,chk)
	local c=e:GetHandler()
	if chk==0 then return c:IsAbleToDeckAsCost() end
	Duel.ConfirmCards(1-tp,c)
	Duel.SendtoDeck(c,nil,SEQ_DECKSHUFFLE,REASON_COST)
end
--The core can only Normal Summon from the hand: "add 1 'Decline' monster that can be Normal Summoned from the Deck
--to the hand, then Normal Summon it". The monster must be summonable once in the hand (Level 4 or lower, or the
--Tributes are there; this card's own procedure counts for another "Decline Idol").
function s.sumfilter(c,tp)
	if not (c:IsSetCard(SET_DECLINE) and c:IsMonster() and c:IsAbleToHand()) then return false end
	if not (c:IsSummonableCard() and Duel.IsPlayerCanSummon(tp,SUMMON_TYPE_NORMAL,c)) then return false end
	local lv=c:GetLevel()
	if lv<=4 then return Duel.GetLocationCount(tp,LOCATION_MZONE)>0 end
	if Duel.CheckTribute(c,lv<=6 and 1 or 2) then return true end
	return c:IsCode(id) and Duel.CheckTribute(c,1,1,Duel.GetMatchingGroup(s.otfilter,tp,LOCATION_MZONE,LOCATION_MZONE,nil,tp))
end
function s.sumtg(e,tp,eg,ep,ev,re,r,rp,chk)
	if chk==0 then return Duel.IsExistingMatchingCard(s.sumfilter,tp,LOCATION_DECK,0,1,nil,tp) end
	Duel.SetOperationInfo(0,CATEGORY_TOHAND,nil,1,tp,LOCATION_DECK)
	Duel.SetOperationInfo(0,CATEGORY_SUMMON,nil,1,0,0)
end
function s.sumop(e,tp,eg,ep,ev,re,r,rp)
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_SUMMON)
	--this card was shuffled into the Deck as the cost: it cannot pick itself
	local tc=Duel.SelectMatchingCard(tp,s.sumfilter,tp,LOCATION_DECK,0,1,1,e:GetHandler(),tp):GetFirst()
	if not tc or Duel.SendtoHand(tc,nil,REASON_EFFECT)==0 or not tc:IsLocation(LOCATION_HAND) then return end
	Duel.ConfirmCards(1-tp,tc)
	if tc:IsSummonable(true,nil) then Duel.Summon(tp,tc,true,nil) end
end
function s.rmfilter(c)
	return c:IsFaceup() and c:GetAttack()<c:GetBaseAttack() and c:IsAbleToRemove()
end
function s.rmtg(e,tp,eg,ep,ev,re,r,rp,chk)
	local g=Duel.GetMatchingGroup(s.rmfilter,tp,0,LOCATION_MZONE,nil)
	if chk==0 then return #g>0 end
	Duel.SetOperationInfo(0,CATEGORY_REMOVE,g,#g,0,0)
end
function s.rmop(e,tp,eg,ep,ev,re,r,rp)
	local g=Duel.GetMatchingGroup(s.rmfilter,tp,0,LOCATION_MZONE,nil)
	if #g>0 then Duel.Remove(g,POS_FACEUP,REASON_EFFECT) end
end
